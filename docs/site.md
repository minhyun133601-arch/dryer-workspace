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

1층 출입구 계단과 1.5→3층 연결 계단은 별개의 구조입니다. 계단을 수정할 때 접근 바닥, 두 런과 중간참, 위층 개구부, 도착문, 도착 후 통로를 함께 확인하세요. 벽·천장은 잘라 보는 시점과 사람 시점에서 다르게 표시됩니다.

위치·치수가 영상 비례인 곳은 실측값으로 취급하지 않습니다. 직원이 확인한 이름·장소와 현재 영상의 관계를 우선하고, 과거 도면의 미확인 설비를 현재 설치물로 다시 추가하지 않습니다.

## 수정 후 확인

브라우저 저장 배치가 기본 배치보다 우선할 수 있습니다. 사용 중인 브라우저의 `dryer-facility-layout-v1`을 먼저 확인하고, 기존 ID·사용자 이동을 보존하는 이관 규칙을 적용하세요. 배치 복원은 0.25m 격자를 사용하므로 연결 부품·점검대·개구부의 정렬을 실제 저장값으로 확인합니다.

관련 기능을 실제 화면에서 확인한 뒤 `npm run check`와 `npm test`를 실행합니다. 공유본 변경이 필요하면 `npm run export:share` 또는 `npm run export:presentation`을 다시 실행합니다. 자산 변경 절차는 [자산 관리](assets.md)에 있습니다.

과거 원본·영상·검토 화면·작업 기록은 바탕화면 `프로젝트_정리자료_20261113`에 모았습니다. [보관 위치 안내](archived-materials.json)의 `archiveRoot`와 `manifestPath`에서 보관 폴더와 이동 목록을 찾습니다. 보관 폴더의 `정리내역.csv`·`정리내역.json`에 원래 경로와 현재 경로가 있습니다.