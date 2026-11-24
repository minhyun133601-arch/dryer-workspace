# 영역별 모델 수정 위치

`apps/site/`에서 데이터 모듈은 이름·기본 위치·치수·설명을, 모델 모듈은 실제 형상을 관리합니다. 공통 화면은 `app.js`, 렌더링과 시점·표시는 `scene.js`에 있습니다.

## 영역별 파일

| 대상 | 데이터·배치 | 형상·주변 공간 |
| --- | --- | --- |
| 공장 전경·건물 | `campus-data.js` | `campus-models.js`, `campus-rear-models.js` |
| 건조실 전체 층·설비 목록 | `building-data.js`, `facility-data.js`, `data.js` | `facility-models.js` |
| 건조실 건물·부분층·계단 | `dryer-building-data.js` | `dryer-building-envelope.js`, `dryer-route-environment.js` |
| 건조실 1층·3층 설비 | `dryer-lower-registration.js`, `facility-data.js` | `dryer-process-models.js` |
| 출입구·생산 주변 | `entrance-route-data.js` | `entrance-production-models.js` |
| 조제실 | `preparation-data.js` | `preparation-models.js`, `preparation-environment.js` |
| 건조실 상부·옥상 | `dryer-upper-data.js` | `dryer-upper-models.js` |
| 버너 상세·도면 | `furnace-drawing-data.js` | `furnace-model.js`, `furnace-drawing-model.js`, `furnace-detail.js` |
| 버너 정비자료 | `burner-maintenance-data.js` | `burner-maintenance.js` |
| 보일러실·후면 계단 | `campus-data.js`, `rear-survey-data.js` | `boiler-models.js`, `rear-stair-models.js` |
| 스틱·소포장동 | `packaging-data.js`, `packaging-transport-data.js`, `team2-card-data.js` | `packaging-models.js`, `packaging-environment-v2.js`, `packaging-equipment-v2.js`, `packaging-line-models.js`, `packaging-routes.js` |
| 2팀 9동 3층 작업장 | `packaging-floor3-data.js`의 게시 위치도, 설비 위치와 PDA | `packaging-floor3-environment.js`의 작업대·출입구, `packaging-mixing-models.js`의 믹서·시프트·호퍼, `packaging-storage-models.js`의 렉·평치, `packaging-kit.js`의 공통 부품 |
| 1팀 2파트 건조실 3층 | `dryer-building-data.js`의 두 작업구역·계단참·옥상 통로, `dryer-lower-registration.js`의 디스크 컨베이어 | `dryer-process-models.js`의 이송관과 공통 점검대, `dryer-building-envelope.js`의 바닥과 출입문, `dryer-route-environment.js`의 작업장 |
| 에어컴프레셔실 | `dryer-compressor-records.js`의 현장 사양과 사진 번호, `dryer-compressor-manuals.js`의 제조사 자료 | `dryer-compressor-environment.js`의 배치, `dryer-compressor-interior-details.js`의 외형, `dryer-compressor-view.js`의 실내 배치도·A-015·영상 대조·명판 조회 |
| 액상 | `liquid-data.js`, `liquid-assets.js` | `liquid-models.js`, `liquid-card-models.js`, `liquid-detail.js` |
| 실외기실 | `outdoor-data.js`, `outdoor-card-data.js`, `outdoor-drawing-data.js`, `outdoor-survey.js` | `outdoor-models.js` |
| 냉동기 상세 | `chiller-data.js` | `chiller-model.js`, `chiller-detail.js` |
| 폐수처리장 | `wastewater-data.js` | `wastewater-models.js` |

## 공통 동작

| 작업 | 파일 |
| --- | --- |
| 버튼·목록·상세 정보·층 전환 | `app.js`, `index.html`, `styles.css` |
| 카메라·렌더링·표시 범위·설비 객체 | `scene.js` |
| 배치 편집·저장·복원 | `layout-editor.js`, `placement-rules.js` |
| 사람 이동·바닥 지지·문 작동 | `person-walk.js`, `proximity-doors.js`, `scene.js` |
| 활성 이미지·표시 허용 | `asset-catalog.js`, `evidence-assets.js` |
| 상세창 카메라 | `detail-camera.js` |

## 건조실 층과 동선

화면의 **1.5층**은 저장 호환을 위해 내부 층 키 `2`를 사용합니다. 1층·1.5층은 넓은 저층동, 3층은 줄어든 타워와 연결 계단으로 구성하며 저층동 지붕을 실내 바닥과 구분합니다.

1층과 1.5층의 입체·평면·통로 보기에서는 선택한 층의 바닥·방·설비만 표시합니다. 1층은 충전·외포장·조제실, 1.5층은 탈의실·OP실·관찰 통로입니다. 사람 시점에서 계단을 오르거나 관찰창 아래를 내려다볼 때는 인접 층을 원래 높이에 표시하며, 아래의 생산설비는 1층 소속을 유지합니다. 조제실과 보일러실 사이에는 직접 연결문이 없습니다(2026-11-13 사용자 확인).

사람 시점은 키 1.75m·눈높이 1.65m·몸 반경 0.3m를 사용합니다. 기본 보행은 1.35m/s이며 Shift 이동은 2.7m/s입니다. 벽·설비·닫힌 문과 낮은 천장을 통과하지 않고 실제 출입구와 계단으로 이동합니다. 넓은 화면에서는 과도한 광각을 줄이며 시야 조절은 몸이나 건물 치수를 바꾸지 않습니다. SW 계단 아래처럼 머리 높이가 부족한 구간은 북측 통로로 돌아 접근합니다.

1층 출입구 계단과 1.5→3층 연결 계단은 별개의 구조입니다. 발표 동선은 두 계단의 실제 디딤판과 중간참을 따라 오릅니다. 1.5층에서는 탈의실에서 직진해 관찰 통로와 OP실을 지나 끝의 계단으로 3층에 연결됩니다. 계단을 수정할 때 접근 바닥, 두 런과 중간참, 위층 개구부, 도착문, 도착 후 통로를 함께 확인하세요. 벽·천장은 잘라 보는 시점과 사람 시점에서 다르게 표시됩니다.

발표 경로는 기본 3분 56초로 약 4분입니다. 6층에서 7층으로 이어지는 실제 계단과 옥상 서비스 구역·엘리베이터 기계실 내부도 살펴봅니다. 발표 전용 경로가 통과할 문을 미리 부드럽게 열고, 한 번 열린 문은 유지해 걷는 흐름을 이어갑니다. 문이 충분히 열리기 전에는 문턱을 통과하지 않으며 별도의 문 조작 안내나 버튼은 표시하지 않습니다. 이 동작은 일반 3D의 문 조작 설정과 분리합니다. 배속은 0.5·1·1.5·2·3배로 유지합니다.

1.5층에는 엘리베이터가 정차하지 않으므로 승강장 문·버튼·정차 안내를 만들지 않습니다. 원료계량창고에서 문으로 연결되는 곳은 조제실이며, 일일 원료 보관창고와 계량창고 사이는 벽·문 없이 열린 공간입니다. 에어커튼 옆의 공유 칸막이나 그 벽에 붙은 창틀을 다시 만들지 않습니다. 내부 고속셔터는 계량창고 남벽의 출입구와 같은 축에 두고, 문 전폭의 양방향 접근을 막는 벽·파레트를 배치하지 않습니다. 수동 1층 평면은 인접 보일러실 내부를 포함하며, 자동 발표 경로는 건조기와 버너에 한정합니다.

탱크 작업대 아래에서 외포장실로 나가는 문은 열기·닫기 조작 시 벽을 따라 옆으로 열리는 미닫이입니다. 균질기와 뒤쪽 이송 펌프는 연결 관계를 유지한 채 옆으로 옮겨 출입문 앞을 비웁니다. 이전 기본 배치는 두 장치만 한 번 이관하며, 직접 옮기거나 회전한 배치는 보존합니다.

11월 13일 보완 영상은 [1층 영상 근거 목록](first-floor-supplement-20261113.json)에서 클립별로 관리합니다. `first-floor-20261113-clip1`(80.219초)은 조제실 작업대, 백색 이동식 장치, Fristam 후드, 균질기 전면·측면과 외포장실 출입구를 대조합니다. `first-floor-20261113-clip2`(163.002초)는 외포장 매거진·롤러·펜스, 기존 1층 엘리베이터, 낮은 컨베이어 횡단 발판과 OP실 진입 전 하행 계단을 대조합니다. 횡단 발판은 층간 계단과 구분하며 엘리베이터 문·패널을 별도 승강기로 중복 추가하지 않습니다.

선정 사진은 클립별 6장씩 등록하고, 원본 영상·TXT와 회전 메타데이터를 적용한 원본 해상도의 디코딩 PNG를 보존합니다. 근거 목록은 원본 파일·해시·길이, 선정 사진의 초수·자산 경로와 구조별 근거 연결을 분리해 기록합니다. 휴대폰 GPS와 방위각은 설비 실측 좌표·층 높이로 사용하지 않습니다.

위치·치수가 영상 비례인 곳은 실측값으로 취급하지 않습니다. 직원이 확인한 이름·장소와 현재 영상의 관계를 우선하고, 과거 도면의 미확인 설비를 현재 설치물로 다시 추가하지 않습니다.

## 수정 후 확인

브라우저 저장 배치가 기본 배치보다 우선할 수 있습니다. 사용 중인 브라우저의 `dryer-facility-layout-v1`을 먼저 확인하고, 기존 ID·사용자 이동을 보존하는 이관 규칙을 적용하세요. 배치 복원은 0.25m 격자를 사용하므로 연결 부품·점검대·개구부의 정렬을 실제 저장값으로 확인합니다.

관련 기능을 실제 화면에서 확인한 뒤 `npm run check`와 `npm test`를 실행합니다. 공유본 변경이 필요하면 `npm run export:share` 또는 `npm run export:presentation`을 다시 실행합니다. 자산 변경 절차는 [자산 관리](assets.md)에 있습니다.

과거 원본·영상·검토 화면·작업 기록은 바탕화면 `프로젝트_정리자료_20261113`에 모았습니다. [보관 위치 안내](archived-materials.json)의 `archiveRoot`와 `manifestPath`에서 보관 폴더와 이동 목록을 찾습니다. 보관 폴더의 `정리내역.csv`·`정리내역.json`에 원래 경로와 현재 경로가 있습니다.
