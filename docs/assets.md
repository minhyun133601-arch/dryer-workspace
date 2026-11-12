# 이미지·자료 관리 안내

화면에 쓰는 이미지는 `apps/site/assets/`에 모으고, 원본 근거와 검토 기록은 `references/`에 보관합니다. 이미지 이름이나 위치를 찾을 때는 [자산 목록 CSV](asset-index.csv)를 설비명·도면명으로 검색하세요. 코드에서는 `apps/site/asset-catalog.js`의 `SITE_ASSETS`가 폐수처리장 도면 3장과 캠퍼스 설비 위치 도면을 포함한 활성 이미지 187개의 ID·경로·이름·분류를 관리합니다.

프로젝트 전체 파일의 목적별 위치는 [파일 정리 안내](../workspace/file-organization-20261112/README.md), 개별 파일은 같은 폴더의 `project-file-index.csv`에서 찾습니다. 원본과 검토 산출물은 현재 앱에 필요한 이미지와 구분해 보관합니다.

## 용도별 위치

| 위치 | 용도 | 이름 예시 |
| --- | --- | --- |
| `apps/site/assets/brand/` | 공식 로고 | 회사명·로고 용도가 드러나는 SVG |
| `apps/site/assets/drawings/campus/` | 공장 전체 배치·출입구 도면 | 대상·도면 종류·원도면 연도 |
| `apps/site/assets/drawings/wastewater/` | 폐수처리장 계통·평면·측면도 화면용 이미지 | `process-flow-2022.png`, `structure-plan-2022.png` |
| `apps/site/assets/drawings/dryer/` | 건조실 층별 평면·단면 | 대상 층과 평면·단면 구분 |
| `apps/site/assets/drawings/preparation/` | 조제실 벽면 현행 배치도 촬영본 | 배치도 이름과 원영상 시각 |
| `apps/site/assets/drawings/packaging/` | 스틱·소포장동 건축·작업장·동선 도면 | 층·도면 용도·자료 연도 |
| `apps/site/assets/drawings/outdoor/` | 실외기실 장비·유틸리티·공조 도면 | 연도와 계통·배치 구분 |
| `apps/site/assets/drawings/furnace/` | 버너 조립·배관 도면 | 버너 대상과 조립·배관 구분 |
| `apps/site/assets/drawings/chiller/` | 냉동기 스캔 22쪽·제조사 참고 도면 | 원본 쪽 번호와 도면 내용 |
| `apps/site/assets/equipment-cards/liquid/` | 3팀 액상 카드 52건의 네 방향 합성 이미지 | `042-pet-filler-28mm/four-views.jpg` |
| `apps/site/assets/equipment-cards/outdoor/` | 3팀 실외기실 14카드의 대표·방향별 이미지 | `072-air-handler-20rt-2/front.jpg` |
| `apps/site/assets/documents/dryer-burner/` | 꼭대기 버너에서 여는 PPT 정비자료 2건·3쪽 | 자료별 폴더의 `slide-001.jpg` |
| `apps/site/assets/share/chiller/`, `share/liquid/` | 공유용 최적화 이미지 76개 | 대응하는 본 이미지의 의미·카드 폴더를 유지 |
| `references/` | 원본 도면·카드·첨부, 해시 목록과 검토 기록 | 원본 출처와 수집 묶음을 유지 |
| `references/guardhouse-team2-20261112/source/` | 경비실→2팀 입구 신규 연속촬영 원본·GPS | 촬영 시각·GPS가 포함된 원래 MP4·TXT 이름 보존 |
| `references/wastewater-20261112/source/` | 폐수처리장 원본 PDF 3장 | 원본 한글 도면 이름 보존 |
| `workspace/reviews/<주제>/` | 완료된 도면·영상 판독, 검토 도구와 캡처 | 원래 검토 묶음·상대 파일명 유지 |
| `workspace/verification-archive/<날짜>/<주제>/` | 과거 검사·내보내기 로그 | 날짜·대상·검사 종류 |

실외기 카드의 `overview.jpg`는 원본 합성 대표 이미지이며 `front.jpg`, `left.jpg`, `right.jpg`, `rear.jpg`는 카드에 저장된 방향입니다. 이 방향을 공장 방위나 모델 좌표축으로 해석하지 않습니다. 카드 번호와 모델 설비 ID는 서로 다른 식별자입니다.

냉동기 22쪽 스캔 원본은 `references/chiller-20261110/source/chiller-technical-drawings-and-certificates-20261110.pdf`입니다. 이전 파일명은 `Image_20261110_0001.pdf`이며, 2026-11-10은 스캔일입니다. 원도면 작성일·준공일과 구분합니다. OWP 층별 참고 이미지 5개는 `references/owp-team2-20261029/derived-images/`에 역사 자료로 보관합니다.

## 이름과 경로 규칙

파일과 폴더 이름은 영문 소문자·숫자·하이픈을 사용합니다. `image`, `sheet`, `final`, `new`만으로 구분하는 대신 대상과 용도를 적습니다. 원본 페이지·카드 등록번호·원도면 연도·영상 시각처럼 출처를 확인하는 정보는 유지합니다. 폴더가 설비를 식별하므로 방향별 파일명은 `front.jpg`처럼 짧게 쓸 수 있습니다.

자산 목록의 `id`는 경로와 별도로 유지합니다. 이름을 다듬거나 파일을 옮겨도 같은 자료라면 ID를 유지하고 `path`를 수정합니다. 한국어 이름은 `label`, 용도 구분은 `category`에 기록합니다. 공유용 별도 파일이 있으면 `sharePath`로 연결합니다. 각 경로는 프로젝트의 기존 상대 경로 형식을 따릅니다.

## 이미지 추가

1. 출처·대상·카드 번호 또는 도면 쪽을 확인하고 원본을 해당 `references/` 묶음에 보관합니다. 이전 수집 묶음의 원본 파일과 해시 기록은 덮어쓰지 않습니다.
2. 화면용 파일을 위 표의 폴더에 넣습니다. 설비 카드는 기존 등록번호를 유지하고, 새 도면은 내용이 드러나는 이름을 정합니다.
3. `apps/site/asset-catalog.js`의 `SITE_ASSETS`에 고유한 `id`, `path`, `label`, `category`를 등록합니다. 공유본에 이미 포함하는 유형이라면 필요한 최적화본을 `assets/share/`에 넣고 `sharePath`도 연결합니다. 자산 등록만으로 공유 포함 범위가 확대되지는 않습니다.
4. 해당 화면의 데이터 파일에서 자산을 연결합니다. 액상은 `liquid-assets.js`, 실외기 카드는 `outdoor-card-data.js`, 냉동기는 `chiller-data.js`, 실외기 도면은 `outdoor-drawing-data.js`를 먼저 확인합니다. 다른 도면은 [모델 수정 위치](#모델-수정-위치)의 대상 구역 데이터에서 찾습니다.
5. `npm run assets:index`로 검색용 CSV를 갱신하고 `npm run check`, `npm test`를 실행합니다. `check`에는 `assets:check`의 이미지 경로·등록 검사와 CSV 최신 여부 검사가 포함됩니다. 해당 구역에서 이미지와 캡션을 확인한 뒤 `npm run export:share`로 공유 파일을 다시 만듭니다.

## 이미지 교체·이동

같은 자료의 화면 품질을 개선하는 경우 자산 ID와 의미 있는 경로를 유지해 화면용 파일을 교체합니다. 별도 공유용 파일이 있으면 함께 갱신합니다. 다른 개정의 도면이나 다른 설비 사진은 별도 자산으로 등록하고 적용한 근거를 기록합니다.

이름이나 위치를 바꿀 때는 자산 목록, 해당 데이터를 참조하는 코드, 공유용 경로를 함께 수정하고 `npm run assets:index`로 CSV를 갱신합니다. `rg -n '이전파일명' apps tooling tests docs`로 남은 사용처를 확인하세요. 과거 작업 당시의 사실을 기록한 원본 manifest·검토 JSON은 원문을 유지하고 이동 기록으로 연결합니다. 자산 검사를 통과한 뒤 실제 로컬 화면과 다시 생성한 공유본을 확인합니다.

이번 정리의 이전→현재 경로와 SHA256은 [2026-11-12 이동 이력](asset-organization-20261112.json)에 있습니다. 과거 기록에 `photos/`, `offline-assets/`, `apps/site/references/` 경로가 보이면 이 파일에서 `originalPath`로 찾아 `currentPath`를 확인합니다. 이미지 바이트를 바꾸지 않은 이동은 같은 SHA256으로 검증할 수 있습니다.

추가 파일 정리로 `tmp/`의 완료된 판독·검증 결과와 루트의 원본 자료를 옮긴 경로는 `workspace/file-organization-20261112/move-receipt.json` 및 `route-source-move-receipt.json`에 있습니다. 이 두 목록도 `originalPath`→`currentPath`와 SHA256으로 찾습니다. 역사 manifest의 당시 경로는 덮어쓰지 않습니다. `tmp/`에는 현재 로컬 서버 상태를 두고, 새 검토 작업의 지속 보관 결과는 `workspace/<작업명>/` 또는 `workspace/reviews/<주제>/`에 남기세요.

이동한 검토 도구의 실행 import·프로젝트 루트 경로 보정 8건은 같은 폴더의 `script-path-repairs.json`에 별도로 기록합니다. 이동 당시 원본 SHA256과 보정 후 SHA256을 구분하며, 역사 JSON에 적힌 당시 경로와 촬영·도면 바이트는 변경하지 않습니다.

## 모델 수정 위치

버너 정비자료는 `burner-maintenance-data.js`에서 문서명·날짜·페이지를 관리하고 `burner-maintenance.js`가 확대·페이지 넘김을 담당합니다. 원본 PPT/PPTX와 SHA256은 `references/dryer-burner-maintenance-20261112/`에 보존합니다. 원문 설치장소 ‘건조실 5층’은 변경하지 않고 요청한 상부 버너에 자료 열람을 연결했습니다.

| 바꾸려는 내용 | 먼저 확인할 파일 |
| --- | --- |
| 공장 전경 건물의 이름·기본 위치 | `apps/site/campus-data.js` |
| 전경 건물·뒤편 탱크·보일러실 외형 | `campus-models.js`, `campus-rear-models.js`, `boiler-models.js` |
| 폐수처리장 공정·치수·형상 | `wastewater-data.js`, `wastewater-models.js` |
| 건조실 건축·층 높이 | `dryer-building-data.js`, `dryer-building-envelope.js`, `dryer-lower-registration.js` |
| 조제실 탱크·작업발판·배관·실내 배치 | `preparation-data.js`, `preparation-models.js`, `preparation-environment.js` |
| 건조실 하부층·상부층·기존 7층 설비 | `facility-data.js`, `dryer-upper-data.js`, `data.js`와 대응 모델 파일 |
| 스틱·소포장 설비·층별 구조·이송선 | `packaging-data.js`, `packaging-*-v2.js`, `packaging-transport-data.js`, `packaging-line-models.js` |
| 액상 방·카드·설비 형상 | `liquid-data.js`, `liquid-assets.js`, `liquid-card-models.js`, `liquid-models.js` |
| 실외기실 설비·카드·도면 | `outdoor-data.js`, `outdoor-card-data.js`, `outdoor-drawing-data.js`, `outdoor-models.js` |
| 버너·냉동기 상세 | `furnace-drawing-data.js`, `furnace-drawing-model.js`, `chiller-data.js`, `chiller-model.js` |
| 선택·카메라·사람 이동·자동문 | `app.js`, `scene.js`, `person-walk.js`, `proximity-doors.js` |
| 배치 편집·이동 범위·자동 저장 | `layout-editor.js`, `placement-rules.js` |
| 공유 HTML 생성 | `tooling/export-site.mjs`, `tooling/export-share.mjs` |

표에서 경로를 생략한 파일은 `apps/site/` 안에 있습니다. 모델 데이터의 설비 ID·층 ID와 배치 저장 키 `dryer-facility-layout-v1`은 이미지 정리 때문에 바꾸지 않습니다. 기존 사용자가 옮긴 배치는 같은 브라우저·프로토콜·호스트·포트의 저장소에서 복원되므로 확인을 위해 브라우저 저장소를 지우지 마세요. 다른 환경으로 옮길 때는 화면의 배치 파일 저장·불러오기를 사용합니다.

## 원본 보존과 기존 자료 정리

화면용·공유용 파일이 같은 바이트여도 원본 보존과 배포를 위해 역할을 나눠 보관할 수 있습니다. 특히 냉동기 주요 도면의 공유용 파일과 본 이미지 일부는 의도적으로 동일합니다. 이름이나 해시가 같다는 이유만으로 원본·공유본을 삭제하지 않습니다.

11/12에 일반 근거 사진·영상과 다른 팀 카드 파일을 바탕화면 `삭제 예정/프로젝트_자료정리_20261112/`로 옮긴 정책은 유지합니다. 해당 자료는 `workspace/cleanup-20261112/move-plan.json`으로 추적하며 이번 자산 정리 과정에서 다시 화면에 연결하지 않습니다. 도면 검토앱의 원본 CAD·미리보기·검토 DB는 별도 기능의 자료이므로 이 안내의 앱 이미지 폴더로 옮기지 않습니다.
