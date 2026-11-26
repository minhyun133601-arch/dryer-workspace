# 영역별 모델 수정 위치

`apps/site/`에서 데이터 모듈은 이름·기본 위치·치수·설명을, 모델 모듈은 실제 형상을 관리합니다. 공통 화면은 `app.js`, 렌더링과 시점·표시는 `scene.js`에 있습니다.

## 영역별 파일

| 대상 | 데이터·배치 | 형상·주변 공간 |
| --- | --- | --- |
| 공장 전경·건물 | `campus-data.js` | `campus-models.js`, `campus-rear-models.js` |
| 건조실 전체 층·설비 목록 | `building-data.js`, `facility-data.js`, `data.js` | `facility-models.js` |
| 건조실 건물·부분층·계단 | `dryer-building-data.js` | `dryer-building-envelope.js`, `dryer-route-environment.js` |
| 건조실 1층·3층 설비 | `dryer-lower-registration.js`, `facility-data.js` | `dryer-process-models.js` |
| 건조실 1층 사진 보강(2026-11-26) | 좌표는 모듈 안 평면 좌표 | `dryer-floor1-photo-detail.js`: 조제실 바닥 트렌치·펌프·포대, 외포장실 라인 시작부·지대 라인·랩핑기·팬·배관 |
| 출입구·생산 주변 | `entrance-route-data.js` | `entrance-production-models.js` |
| 조제실 | `preparation-data.js` | `preparation-models.js`, `preparation-environment.js` |
| 건조실 상부·옥상 | `dryer-upper-data.js` | `dryer-upper-models.js` |
| 버너 상세·도면 | `furnace-drawing-data.js` | `furnace-model.js`, `furnace-drawing-model.js`, `furnace-detail.js` |
| 버너 정비자료 | `burner-maintenance-data.js` | `burner-maintenance.js` |
| 보일러실·후면 계단 | `campus-data.js`, `rear-survey-data.js` | `boiler-models.js`, `rear-stair-models.js` |
| 스틱·소포장동 | `packaging-data.js`, `packaging-transport-data.js`, `team2-card-data.js` | `packaging-models.js`, `packaging-environment-v2.js`, `packaging-equipment-v2.js`, `packaging-line-models.js`, `packaging-routes.js` |
| 2팀 9동 3층 작업장 | `packaging-floor3-data.js`의 게시 위치도, 설비 위치와 PDA | `packaging-floor3-environment.js`의 작업대·출입구, `packaging-mixing-models.js`의 믹서·시프트·호퍼, `packaging-storage-models.js`의 렉·평치, `packaging-kit.js`의 공통 부품 |
| 1팀 2파트 건조실 3층 | `dryer-building-data.js`의 두 작업구역·계단참·옥상 통로, `dryer-lower-registration.js`의 디스크 컨베이어 | `dryer-process-models.js`의 이송관과 공통 점검대, `dryer-building-envelope.js`의 바닥과 출입문, `dryer-route-environment.js`의 작업장 |
| 에어컴프레셔실 | `dryer-compressor-records.js`의 현장 사양과 사진 번호, `dryer-compressor-manuals.js`의 제조사 자료 | `dryer-compressor-environment.js`의 배치, `dryer-compressor-interior-details.js`의 외형, `dryer-compressor-site-finish.js`의 실내 조명·마감·배관·전기·덕트, `dryer-compressor-view.js`의 실내 배치도·A-015·영상 대조·명판 조회 |
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

## 실사 재현 기준 (2026-11-25)

설비 외형은 2026년 11월 24일 현장등록카드 4면 사진을 먼저 따르고, 영상, 준공도면 순으로 대조합니다. 현장등록카드의 층 표기(2~5층)는 사이트 층보다 하나 낮습니다. 사진을 보고 내린 판단이며 사용자 확인 전입니다.

| 구역 | 카드 | 반영 위치 |
| --- | --- | --- |
| 1층 청정실·외포장 | 04~07, 11, 12 | `dryer-process-models.js`의 `packingCardDetails`, `bagFillingLine`, `transferDetailCasePacker` |
| 3층 | 13~22 | 같은 파일의 `routeConeBank`, `plateExchanger`, `agitatorTank`, `cylinderSideEquipment`, `routeCipDeck` |
| 4층 | 02, 03 | 같은 파일의 `fourthFluidBed`, `fourthVibratingConveyor`, `fourthTransferChute` |
| 5층 | 23~31 | `facility-models.js` |
| 6·7층 | 32~36 | `dryer-upper-models.js`, `furnace-model.js` |
| 2팀 1~2층 | 008~041 | `packaging-line-models.js`의 `CARD_FINISH` |

- 조명은 `equipment-lighting.js`의 `LIGHT_PROFILES`가 정합니다. 사람 시점은 `interior`, 잘라 본 화면과 평면은 `cutaway`, 전경·실외기·옥상은 `daylight`입니다. 자체 반사 맵을 쓰는 재질도 함께 조절합니다. 에어컴프레셔실은 자체 조명을 유지합니다.
- 기둥은 사진이나 영상에 드러난 독립 기둥만 둡니다. 도면 축만 근거로 다시 늘리지 않습니다.
- 카탈로그에 없던 설비 두 개를 추가했습니다. `f1-bag-line`(카드 11·12)은 카드 05~07 배경에서 이카 3호 옆 데크로 보이며, `f3-agitator-tank`(카드 20)는 살균기 열교환기 남쪽에 있습니다. 둘 다 평면 좌표는 추정입니다.
- 도면과 다른 점: 3층 CIP탱크는 영상에서 2기만 보였으나 카드 19·21·22로 3기를 확인했습니다. 3층 홀 바닥 마감은 타워 벽에서 끝나며 남동쪽 저층 지붕으로 나가지 않습니다.
- 조제실 과거 이력카드 사진(2006~2012년)은 바닥이 타일이던 시기라 배치 근거로 쓰지 않았습니다.

## 1층 사진 보강 (2026-11-26)

1.5층 관찰창과 1층 바닥에서 찍은 사진 241장으로 1층을 보강했습니다. 원본은 `references/현장사진_원본/건조실 1층·1.5층-20261126/`에 구역별 7개 폴더로 정리했고, `사진설명.csv`와 `00_밀착인화`가 함께 있습니다. 이동 기록은 [정리 목록](material-organize-20261126.json)에 있습니다.

- 고정 세부는 `dryer-floor1-photo-detail.js` 하나에 모았습니다. 평면 좌표(X 동쪽, Z 남쪽)로 적고 루트에서 [-8.6, 0, -13.4]만큼 옮깁니다. 위치·치수는 사진 비례 추정입니다.
- 조제실: 탱크 열 동쪽의 타공 덮개 배수 트렌치와 붉은 에폭시 띠, 바닥 마모, 탱크 하부 펌프 3대·스트레이너 2기·흰 버킷, 셔터 앞 원료 포대 파레트, 작업대(상판 약 2.45 m) 통로의 크라프트 포대.
- 외포장실: 청정구역 남벽의 라인별 관통구·관찰창, 녹색 벨트, 케이스 패커(크림색 기둥·서보·노란 보호함), YuKwang 테이핑기, 제어함, 노란 횡단 계단, 주황 부품함 선반, 지대 라인의 중량선별기·스테인리스 판·CC-4 곡선 롤러, 남측 통로 아래 회전식 랩핑기와 파레트 공급기, 바닥 노란 구획선, 안전 게시판.
- 대형 실링팬과 색상 배관은 1.5층 바닥이 없는 2층 높이 공간(x 9.5~21.3, z 16.8~30.3) 안에만 둡니다. OP실·중앙 통로 위로 넘어가면 발표 동선의 사람 충돌 검사에 걸립니다.
- **1층 적재 로봇은 1대입니다(2026-11-26 사용자 확인).** 예전 영상 해석으로 두었던 크림색 두 번째 암을 없애고, `f1-palletizer`를 파란 베이스·크림색 몸체(FUJI-ACE)·크림색 링크 팔·포크형 포대 집게 1대로 바꿨습니다. 셀 안에 SCE 크라프트 포대를 쌓는 빨간 파레트가 있습니다. 두 번째 로봇을 다시 추가하지 마세요.
- 공정순서 영상 `공정순서(수정).mp4`(20분, 화면 날짜 2015년대)는 입고→보관→용해→혼합→가열→균질→건조→채선별→이송→소포장→박스포장→로봇 적재 순서를 설명합니다. 5초 요약컷은 `references/현장사진_원본/공정순서 영상(수정)-5초 요약컷/`에 있습니다. 영상의 옛 설비 모습(주황 원형 가드 등)과 11월 26일 사진이 다르면 사진을 따릅니다.
- 설비 세부(사진 대조): 케이스 패커는 구멍 뚫린 쌍기둥·박스 보·Z축 서보·노랑/검정 케이블 체인·노란 망 보호함, 테이핑기는 YuKwang 문형 틀·안쪽 스테인리스 틀·양옆 구동 벨트와 세운 기어모터·옆 제어함, 지대 라인은 금속검출 터널·흰 벨트·적녹 경광등, 랩핑기는 체인 두 줄 회전판·필름 마스트·누름 팔, 파레트 공급기는 2단 틀·회색 모서리 안내판입니다. 롤러에는 가이드 봉·손잡이 브래킷, 벨트에는 풀리·흰 모터·파란 감속기가 있습니다.
- **1층 적재물은 2팀 3층처럼 설비 목록에서 고르고 옮길 수 있는 항목 5개입니다**(`dryer-floor1-load-data.js`의 `DRYER_F1_LOAD_EQUIPMENT`, 형상은 `dryer-floor1-photo-detail.js`의 `buildDryerFloor1Load`): 출하 대기 파레트, 원료계량창고 원료 포대 파레트 8개, 조제실 셔터 앞 원료 포대, 빈 파레트 더미, 서쪽 벽 골판지 낱장 묶음. 박스·포대·필름은 `packagingCargo` 층에 있어 1층에서도 「적재물 표시」로 숨길 수 있고, 파레트와 바닥 구획선은 남습니다. 건조실 카탈로그는 55개입니다. 조제실 작업대 위 포대 더미는 의미 없는 적재라 뺐습니다(2026-11-26 사용자 요청).
- **1.5층 입체·통로 보기에서는 관찰창 너머 1층 홀(바닥·고정물·설비)을 원래 높이에 함께 보여 줍니다**(`scene.js`의 `_overlookContextLevels`, 2026-11-26 사용자 요청). 평면 보기와 배치 편집에서는 층을 분리합니다. 1층 설비 이름표는 1.5층에서 띄우지 않습니다.
- 제어반: 적재 로봇 셀 서쪽 펜스 밖 조작반(화면·버튼·비상정지·경광등·티칭 펜던트)과 회색 로봇 제어 캐비닛은 `f1-palletizer`에 붙어 함께 움직입니다. 1.5층 유리 사무실 아래 동쪽 벽에는 모니터링 책상과 벽시계가 있습니다.
- 컨베이어 연결: 1·2번 라인 롤러는 아래 셀 입구까지, 3번 라인은 비스듬한 합류 롤러까지 이어집니다. 끝이 허공에서 끊기던 짧은 롤러 토막(`observed-green-short-merge`)과, 포대 파레트가 롤러 밑에 겹치던 배치는 정리했습니다.
- 조제실 벽 보강(2026-11-26): 탱크 뒤 서쪽 칸막이 위 가로 틈과, 작업대 남쪽 끝과 1.5층 통로 바닥 사이를 크림색 벽판으로 막았습니다(유리 없음, 설비를 가리지 않는 높이). 벽 없이 서 있던 출입 복도의 용도 미확인 문(`corridor-unconfirmed-support`)은 지우고 화장실 서쪽 벽을 이어 막았습니다.
- **조제실 작업대 남쪽 끝의 유리는 1.5층 남측 통로 관찰창 한 장뿐입니다**(2026-11-26 사용자 확인). 1층 쪽에 나란히 있던 작업대 관찰 유리벽을 다시 만들지 마세요.
- 사진 0~11번(사물함·유해화학물질 보관함)은 1층 출입 계단홀입니다. 보관함과 황색 창의 벽 방향을 확정하지 못해 반영하지 않았습니다.

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
