# 희창유업 3D 모델링 작업실

공장·건조실·설비 모델을 수정하고 도면을 검토하는 로컬 프로젝트입니다. 시작 화면에서 **희창유업 3D**와 **도면 근거자료**를 엽니다.

## 실행

**[프로젝트 실행.cmd](프로젝트%20실행.cmd)**를 더블클릭하거나 프로젝트 폴더에서 실행합니다. Node.js 20 이상이 필요하며 도면 검토는 Python 3을 사용합니다.

```powershell
npm start
```

기본 주소는 `http://127.0.0.1:4173`입니다. 서버만 실행할 때는 `npm run serve`, 종료할 때는 실행 창에서 `Ctrl+C`를 누릅니다.

## 수정할 파일 찾기

| 작업 | 안내 |
| --- | --- |
| 설비 위치·이름·형상, 건물·층·계단 | [영역별 모델 수정 위치](docs/site.md) |
| 이미지·도면 추가·교체 | [자산 관리](docs/assets.md), [자산 목록 CSV](docs/asset-index.csv) |
| 메뉴·서버·저장·공유 구조 | [프로젝트 구조](docs/architecture.md) |

실행 소스는 `apps/`, 시작 화면은 `workspace/`의 루트 파일, 실행·검사·공유 도구는 `tooling/`, 검사는 `tests/`에 있습니다. 활성 화면 이미지는 `apps/site/assets/`에서 관리합니다.

## 검사와 공유본 생성

```powershell
npm run check
npm test
npm run export:share
npm run export:presentation
```

`export:share`는 전체 공유본 `exports/건조기-통합-공유.html`, `export:presentation`은 건조실 발표본 `exports/건조실-발표용.html`을 만듭니다. 소스를 수정한 뒤 공유본도 다시 생성해야 반영됩니다.

## 저장 배치

브라우저에서 옮긴 배치는 해당 브라우저의 `localStorage`에 저장됩니다. 기본 위치를 고쳐도 저장 배치가 화면에 우선 적용될 수 있습니다. 문제가 보이면 사용 중인 브라우저·주소의 저장 배치를 먼저 확인하고, 설비 ID나 저장 키를 임의로 바꾸지 않습니다.

과거 원본·영상·검토 화면·작업 기록은 바탕화면 `프로젝트_정리자료_20261113`에 모았습니다. [보관 위치 안내](docs/archived-materials.json)의 `archiveRoot`와 `manifestPath`에서 보관 폴더와 이동 목록을 찾습니다. 보관 폴더의 `정리내역.csv`·`정리내역.json`에 원래 경로와 현재 경로가 있습니다.