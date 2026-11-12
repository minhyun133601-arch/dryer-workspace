# 모델링 작업실 구조

2026-11-12 자산 정리 후 화면에서 쓰는 도면·로고·3팀 설비이력카드 이미지 187개는 `apps/site/assets/`에서 용도별로 관리합니다. 공유용 최적화 이미지 76개는 같은 폴더의 `share/` 아래에 둡니다. 자산의 ID·경로·이름·분류·공유 경로는 `apps/site/asset-catalog.js`, 사람이 찾아보기 위한 목록은 `docs/asset-index.csv`에 있습니다. 추가·교체 절차는 [이미지·자료 관리 안내](assets.md)를 따릅니다.

일반 근거 사진·영상과 다른 팀 카드 원본은 기존 자료 정리 정책대로 바탕화면의 `삭제 예정/프로젝트_자료정리_20261112/`에 원래 상대 경로로 보관합니다. 도면 검토앱의 원본 CAD·도면 이미지·실행 도구·미리보기 캐시·검토 DB는 유지합니다. 해당 이동 목록은 `workspace/cleanup-20261112/move-plan.json`입니다. 이번 이름·위치 변경은 `docs/asset-organization-20261112.json`의 이전 경로·현재 경로·SHA256으로 추적하며, 과거 근거 기록에 적힌 원래 경로는 보존합니다. 화면의 이미지 허용 정책은 `apps/site/evidence-assets.js`에서 관리합니다.

현재 작업실은 **희창유업 3D(site)**와 **도면 근거자료(drawings)** 두 메뉴로 구성합니다. index.html과 workspace/가 메뉴·화면 전환을 담당하고, Node.js 기본 모듈로 만든 tooling/serve.mjs가 같은 로컬 HTTP 출처에서 제공합니다. 시작은 프로젝트 실행.cmd 또는 npm start입니다.

## 소스와 실행 경계

| 위치 | 역할 |
| --- | --- |
| apps/site/ | 공장·건조실·스틱소포장동·액상·실외기실 모델과 배치 편집 |
| apps/site/assets/brand/ | 화면과 공유본에서 쓰는 공식 로고 |
| apps/site/assets/drawings/ | 공장 전경·건조실·조제실·스틱소포장·실외기실·버너·냉동기 도면 이미지 |
| apps/site/assets/equipment-cards/ | 3팀 액상·실외기실 카드별 대표·방향별 이미지 |
| apps/site/assets/share/ | 공유 HTML에 넣는 냉동기·액상 이미지의 최적화본 |
| apps/site/asset-catalog.js | 활성 자산 ID·경로·표시명·분류·공유 경로의 기준 목록 |
| apps/drawings/ | 로컬 도면 근거자료 화면 연결 |
| apps/shared/ | 현장 3D용 공용 라이브러리와 라이선스 |
| 근거 자료/도면검토앱/ | Python 도면 검토 서버, 미리보기 캐시, 검토기록 DB |
| workspace/module-registry.js | site·drawings 기능 목록과 해시 경로 해석 |
| workspace/app.js | 메뉴·카드 생성, iframe 유지, 준비·가시성 메시지 처리 |
| workspace/styles.css | 시작 화면과 메뉴 스타일 |
| tooling/ | 로컬 실행, 검사, 현장 모델과 공유 HTML 내보내기 |
| references/ | 현재 모델링의 원본 근거와 대조 기록 |
| references/owp-team2-20261029/derived-images/ | 과거 OWP 층별 참고 이미지 5개. 활성 이미지 목록과 구분하여 보존 |
| references/chiller-20261110/source/ | 냉동기 기술도면·성적서 22쪽 스캔 원본 |
| docs/assets.md, docs/asset-index.csv | 자산 추가·교체 안내와 경로별 목록 |
| .backups/module-separation-20261110/ | 기능 분리 전 원본 파일, 원래 상대 경로 유지 |

모터·제어판·열교환기 앱과 전용 자료는 바탕화면의 후속작업_모터·제어판·열교환기_20261110 폴더에 별도 보존합니다. 현재 메뉴, 공유 내보내기, 활성 테스트는 이 세 앱을 필요로 하지 않습니다. 예전 #/motor·#/panel·#/heat-exchanger 경로는 전체 보기로 돌아갑니다.

각 활성 기능은 같은 출처의 iframe 안에서 실행하며 다른 기능의 DOM·전역 변수를 직접 수정하지 않습니다. 처음 방문할 때만 iframe을 생성하고 메뉴를 바꿔도 유지하므로 선택·시점·진행 중인 검토 화면이 유지됩니다. 새로고침·창 종료·다시 불러오기는 일시 상태를 초기화합니다. 도면 검토는 별도 로컬 서버와 기존 DB를 사용합니다.

## 경로와 메시지

로컬 기본 경로는 #/site, #/drawings입니다. 등록부의 ID는 중복되지 않는 영문 소문자로 시작하고 영문 소문자·숫자·하이픈을 사용하며 진입 경로는 apps/<ID>/index.html입니다. 메뉴와 홈 카드는 등록 정보로 생성합니다.

초기화가 완료된 기능은 부모에게 준비 메시지를 보냅니다.

~~~js
window.parent.postMessage(
  { type: 'dryer-workspace:ready', moduleId: 'site' },
  location.origin,
);
~~~

부모는 발신 출처·등록된 iframe의 contentWindow·moduleId를 확인합니다. 기능의 화면 전환과 탭 가시성을 합쳐 다음 메시지를 보냅니다.

~~~js
{ type: 'dryer-workspace:visibility', active: true }
~~~

현장 3D는 비활성 메뉴나 숨겨진 브라우저 탭에서 렌더링을 멈추고 다시 보일 때 기존 상태로 재개합니다. 기능 사이 이동 메시지는 등록된 site·drawings 대상만 처리합니다. 메시지 계약으로 저장 데이터나 설비 정보를 자동 공유하지는 않습니다.

## 오프라인·hosted 공유

**2026-11-12 발표용 공유:** `npm run export:presentation`은 건조실만 담은 `exports/건조실-발표용.html`을 만듭니다. 처음에는 **전체·옥상**을 표시하고 사람 시점·아바타를 만들지 않습니다. 공장 전경·액상·스틱소포장·실외기실의 설비 데이터와 모델 생성 모듈도 포함하지 않습니다. 버너 상세창에는 원본 PPT 2건을 그대로 렌더링한 정비자료 3쪽을 내장합니다. 기존 로컬 작업실과 아래 전체 공유 도구는 별도로 유지합니다.

게시용은 `node tooling/export-site.mjs --profile dryer <게시폴더>/index.html`로 같은 결과를 만들고 Sites로 게시합니다. 별도 발표용 배치 저장 키 `dryer-presentation-layout-v1`을 사용하여 기존 작업실의 저장 배치를 보존합니다.

tooling/export-share.mjs는 **export-site.mjs만 호출**합니다. 공유용 이미지 경로는 자산 목록의 `sharePath`로 연결하며 최적화본은 `apps/site/assets/share/`에서 관리합니다. 도면 검토의 서버·원본 파일·DB는 공유 HTML에 포함하지 않습니다. tooling/share-shell.mjs는 메인과 site 탭을 만들고, 처음 site를 열 때 모델 iframe을 생성합니다. 메인으로 돌아가도 같은 iframe과 편집 상태를 유지합니다.

- 단일 HTML: exports/건조기-통합-공유.html 안에 현장 모델·스크립트·스타일·필수 자산을 포함합니다.
- hosted: 작은 index.html, 독립 viewers/site.html, downloads/dryer-workspace.zip을 생성합니다. 게시를 자동 실행하지 않습니다.
- 기존 ?viewer=site, #/site 진입을 유지합니다. 제거한 세 기능과 잘못된 viewer 주소는 메인으로 돌아갑니다.
- 단일 HTML의 iframe은 srcdoc, hosted는 src를 사용하며 숨겨진 프레임과 백그라운드 탭은 일시 정지합니다.
- 저장 버튼은 단일 HTML에서 전체 HTML, hosted에서는 오프라인 ZIP을 받습니다.

공유 파일명·기존 3D 경로·설비 배치 저장 키를 기능 분리 때문에 바꾸지 않습니다. 기존 온라인 게시본은 로컬 파일 생성만으로 변경되지 않습니다.

## 저장값·백업·검사

현재 모델 배치와 도면 검토기록은 기존 저장 방식을 유지합니다. 브라우저 저장값은 프로토콜·호스트·포트가 같은 출처에 속하며, 분리 작업은 보류 기능의 브라우저 저장값을 삭제하지 않습니다. 파일 백업에는 브라우저 저장소가 자동 포함되지 않습니다.

이번 분리 전 workspace·시작 HTML·공유 도구·관련 테스트·문서는 .backups/module-separation-20261110/에 원래 상대 경로로 복사했습니다. ui-share-originals.json의 SHA256으로 원본 사본을 확인할 수 있습니다. 보류 폴더에는 후속 실행에 필요한 원본 앱·자료와 실행 구성을 보존합니다.

npm run assets:check로 자산 목록과 실제 파일을 확인하고, npm run check와 npm test로 현재 소스·자산·동작을 검사합니다. tests/workspace.test.mjs는 활성 두 메뉴·진입 경로·보류 경로의 fallback을, tests/share-export.test.mjs는 site-only 내보내기·오프라인 자산·기존 링크·프레임 상태·가시성·파일 저장·hosted ZIP을 검사합니다. 변경을 공유하려면 검사 후 npm run export:share로 공유 HTML을 다시 만듭니다.
