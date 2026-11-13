# 자산 관리

화면에 쓰는 이미지의 기준 목록은 `apps/site/asset-catalog.js`의 `SITE_ASSETS`입니다. 설비명·도면명으로 찾으려면 [자산 목록 CSV](asset-index.csv)를 검색하세요.

## 활성 자산 위치

| 경로 | 용도 |
| --- | --- |
| `apps/site/assets/brand/` | 공식 로고 |
| `apps/site/assets/drawings/` | 공장·건조실·조제실·스틱소포장·실외기실·폐수처리장·버너·냉동기 도면 |
| `apps/site/assets/equipment-cards/` | 액상·실외기실 설비이력카드 이미지 |
| `apps/site/assets/documents/dryer-burner/` | 버너에서 여는 정비자료 이미지 |
| `apps/site/assets/share/` | 공유 HTML용 최적화 이미지 |

각 폴더와 파일 이름은 영문 소문자·숫자·하이픈으로 작성합니다. 코드의 자산 경로는 `./assets/...` 형식입니다. 자산 ID는 고유하게 유지하고 기존 파일을 바꿀 때 경로·대소문자·이미지 형식을 확인합니다.

## 추가·교체 절차

1. 사용할 파일을 해당 자산 폴더에 넣습니다.
2. `asset-catalog.js`에 ID·분류·표시명·경로를 등록하거나 기존 항목을 수정합니다. 공유용 최적화본이 있으면 `sharePath`도 연결합니다.
3. 해당 영역의 데이터 모듈에서 자산을 연결합니다. 어떤 모듈인지 [모델 수정 위치](site.md)에서 찾습니다.
4. `npm run assets:index`, `npm run assets:check`, `npm run check`를 실행합니다.
5. 실제 화면에서 이미지를 열어 확인하고 필요한 공유본을 다시 생성합니다.

`evidence-assets.js`가 화면에 허용하는 이미지 종류를 정합니다. 경로를 옮길 때는 기준 목록과 사용하는 데이터 모듈을 함께 수정하세요. 공유본에 자산을 넣는 코드는 `tooling/export-site.mjs`, `export-dryer-presentation.mjs`, `site-export-utils.mjs`에 있습니다.

과거 원본·영상·검토 화면·작업 기록은 바탕화면 `프로젝트_정리자료_20261113`에 모았습니다. [보관 위치 안내](archived-materials.json)의 `archiveRoot`와 `manifestPath`에서 보관 폴더와 이동 목록을 찾습니다. 보관 폴더의 `정리내역.csv`·`정리내역.json`에 원래 경로와 현재 경로가 있습니다.