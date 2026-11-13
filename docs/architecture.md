# 프로젝트 구조

## 실행 구성

| 위치 | 역할 |
| --- | --- |
| `index.html`, `workspace/app.js`, `workspace/styles.css`, `workspace/icon.svg` | 시작 화면·메뉴·화면 전환 |
| `workspace/module-registry.js` | 활성 기능과 `#/site`, `#/drawings` 경로 |
| `apps/site/` | 공장·설비 3D, 층·시점 전환, 배치 편집 |
| `apps/site/assets/` | 화면과 공유본에 필요한 로고·도면·카드·정비자료 |
| `apps/shared/vendor/` | Three.js와 라이선스 |
| `apps/drawings/` | 도면 검토 화면 연결 |
| `근거 자료/도면검토앱/` | Python 도면 서버·검토 DB·미리보기 캐시 |
| `근거 자료/건물3D 후보도면/` | 도면 검토에서 여는 원본 |
| `tooling/` | 실행·검사·자산 목록·공유본 생성 |
| `tests/` | 현재 기능의 회귀 검사 |
| `docs/asset-index.csv` | 활성 자산 목록 |

`npm start`는 `tooling/launch.mjs`를 실행하고 `tooling/serve.mjs`가 로컬 HTTP 서버를 제공합니다. 도면 검토 요청은 `drawing-review-service.mjs`를 통해 필요할 때 Python 서버로 연결합니다. 도면 서버의 원본·DB·캐시는 실행 기능의 일부입니다.

각 기능은 같은 출처의 iframe에서 실행합니다. 처음 방문할 때 프레임을 만들고 메뉴를 전환해도 유지합니다. 기능은 준비 시 `dryer-workspace:ready`, 부모는 가시성 변경 시 `dryer-workspace:visibility` 메시지를 사용합니다. 발신 출처·프레임·기능 ID 검증을 유지하세요.

## 모델과 자산

`apps/site/app.js`가 UI를, `scene.js`가 렌더링·시점·객체·표시 상태를 관리합니다. 영역별 데이터와 형상은 별도 모듈에 있습니다. [모델 수정 위치](site.md)와 [자산 관리](assets.md)를 참고하세요.

브라우저가 가져오는 모듈을 바꾸면 `tooling/export-site.mjs`와 `export-dryer-presentation.mjs`의 공유 모듈 구성도 확인해야 합니다. 공유본은 소스를 자동으로 다시 읽지 않습니다.

## 저장 배치

기본 배치와 브라우저 저장 배치는 별개입니다. 로컬 배치 키는 `dryer-facility-layout-v1`, 건조실 발표본은 `dryer-presentation-layout-v1`입니다. 저장 범위는 브라우저와 출처(프로토콜·호스트·포트)에 따라 달라집니다.

배치 복원은 0.25m 격자를 적용합니다. 탱크·점검대·개구부처럼 함께 맞아야 하는 조립체는 격자 적용 뒤에도 정렬되는지 확인하세요. 기본 위치 변경 시 기존 ID, `placementRevision`, `previousPlacements`의 이관 규칙을 검토하고 직접 수정한 사용자 배치를 보존합니다. 파일 백업에는 브라우저 저장값이 자동 포함되지 않습니다.

## 검사와 내보내기

```powershell
npm run check
npm test
npm run export:share
npm run export:presentation
```

`check`는 JavaScript 문법·모듈·HTML·CSS 경로·활성 자산·CSV를 검사합니다. 자산 변경 후에는 `npm run assets:index`로 CSV를 갱신하고 `npm run assets:check`로 확인합니다.

`export:share`는 전체 3D 공유 HTML, `export:presentation`은 건조실 발표 HTML을 생성합니다. 전체 공유 구조는 `export-share.mjs` → `export-site.mjs`와 `share-shell.mjs`이며, 발표본은 `export-dryer-presentation.mjs`를 사용합니다. 도면 검토 서버·원본·DB는 공유 HTML에 포함하지 않습니다. 로컬 내보내기는 게시된 사이트를 갱신하지 않습니다.

과거 원본·영상·검토 화면·작업 기록은 바탕화면 `프로젝트_정리자료_20261113`에 모았습니다. [보관 위치 안내](archived-materials.json)의 `archiveRoot`와 `manifestPath`에서 보관 폴더와 이동 목록을 찾습니다. 보관 폴더의 `정리내역.csv`·`정리내역.json`에 원래 경로와 현재 경로가 있습니다.