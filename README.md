# 희창유업 3D 모델링 프로젝트

공장·설비의 3D 모델과 도면을 검토하는 로컬 작업실입니다. 현재 메뉴는 **희창유업 3D**와 **도면 근거자료**입니다.

2026-11-12 출입구·1층·1.5층·3층 영상 대조 작업은 [완료 기록](docs/work-completion-20261112.md)에 정리했습니다. 건조실의 기존 2층 표시는 1.5층으로 바로잡았으며, 1층 내려다보기와 축소된 3층의 세부 형상을 반영했습니다.

## 실행

**[프로젝트 실행.cmd](프로젝트%20실행.cmd)를 더블클릭**하거나 터미널에서 실행하세요. Node.js 20 이상과 Python 3을 사용하며 별도 패키지 설치나 빌드는 필요 없습니다.

~~~powershell
npm start
~~~

브라우저와 필요한 로컬 서버가 열립니다. 서버만 실행하려면 `npm run serve`, 종료하려면 실행 창에서 Ctrl+C를 누르세요.

## 수정할 곳 찾기

| 수정 내용 | 시작 위치 |
| --- | --- |
| 이미지 찾기·추가·교체 | [이미지·자료 관리 안내](docs/assets.md), [설비명·도면명 목록 CSV](docs/asset-index.csv) |
| 이미지의 ID·현재 경로·한국어 이름·공유용 연결 | [자산 목록 코드](apps/site/asset-catalog.js) |
| 건물·설비 이름과 배치·형상 | [현장 3D 안내](docs/site.md), [구역별 수정 파일 표](docs/assets.md#모델-수정-위치) |
| 메뉴·서버·화면 전환·공유 방식 | [작업실 구조](docs/architecture.md) |
| 버너 도면 판독 | [도면 판독 기록](docs/furnace-drawing-20261105.md) |
| 이전 보정과 모델링 판단 | [2026-11-12까지의 변경 기록](docs/change-history.md) |

폐수처리장 도면 3장과 캠퍼스 설비 위치 도면을 포함한 현재 이미지 **187개**를 로고·도면·설비 카드·버너 정비자료로 나누고, 공유용 최적화본 **76개**를 대응 자료와 연결했습니다. 파일명에는 설비 번호·용도·방향·쪽 번호를 남겼으며 한국어 설명은 CSV와 자산 목록에서 검색할 수 있습니다.

새 촬영 원본은 `references/guardhouse-team2-20261112/source/`, 폐수처리장 원본 PDF는 `references/wastewater-20261112/source/`에 모았습니다. 완료된 판독 이미지·검토 도구·캡처는 `workspace/reviews/`, 과거 검사 로그는 `workspace/verification-archive/`에서 주제별로 찾습니다. **[파일 목적별 안내·전체 경로 목록](workspace/file-organization-20261112/README.md)**과 이동 전후 SHA256 목록으로 이전 경로도 추적할 수 있습니다.

## 파일 구조

~~~text
프로젝트/
├─ 프로젝트 실행.cmd             # 실행
├─ index.html                    # 작업실 시작 화면
├─ apps/
│  ├─ site/                      # 3D 화면·구역 데이터·모델
│  │  ├─ asset-catalog.js         # 활성 이미지의 기준 목록
│  │  └─ assets/
│  │     ├─ brand/               # 공식 로고
│  │     ├─ drawings/            # 공간·설비별 도면
│  │     ├─ equipment-cards/     # 액상·실외기실 카드
│  │     ├─ documents/           # 원본 PPT를 렌더링한 버너 정비자료
│  │     └─ share/               # 공유용 최적화 이미지
│  ├─ drawings/                  # 도면 검토 화면 연결
│  └─ shared/                    # 공용 라이브러리·라이선스
├─ references/                   # 원본 근거·카드 첨부·대조 기록
├─ 근거 자료/                    # CAD·도면 원본·미리보기·검토 DB
├─ workspace/                    # 메뉴·화면 전환과 작업 기록
│  ├─ reviews/                   # 완료된 판독 이미지·검토 도구·캡처
│  ├─ verification-archive/      # 날짜·주제별 과거 검사 로그
│  └─ entrance-route-20261112/   # 경비실→2팀 입구 세부 판독
├─ tooling/                      # 실행·검사·목록 생성·내보내기
├─ tests/                        # 회귀 검사
├─ docs/                         # 수정 안내·자산 목록·변경 이력
├─ exports/                      # 생성한 공유 HTML
└─ .backups/                     # 변경 전 소스 보존
~~~

원본 냉동기 PDF는 [냉동기 기술자료](references/chiller-20261110/README.md)에 있습니다. 앞선 이미지 정리에서 옮긴 **262개 파일**의 이전·현재 경로와 SHA256은 [이동 이력](docs/asset-organization-20261112.json)에 기록했습니다. 이전 근거 manifest는 당시 내용과 경로를 보존합니다.

추가 정리에서는 원본 5개와 완료된 검토 산출물 등을 합쳐 **158개 파일**을 목적별로 옮겼습니다. [새 정리 기록](workspace/file-organization-20261112/README.md)에 이전·현재 경로와 해시가 있습니다. 도면 검토 원본·DB, 게시 체크아웃, 복구용 소스와 현재 서버 상태는 기존 위치를 유지합니다.

## 수정 후 확인·공유

[현재 발표용 공유 링크](https://dryer-map-share-20261030.kjs1335.chatgpt.site)는 **건조실만** 보여주며 처음에는 **전체·옥상**으로 열립니다. 건조실에 들어가면 층·설비 선택과 관계없이 상단 **버너 · 도면·정비자료** 버튼이 항상 보입니다. 도면과 연소팬 정비자료 2건·3쪽을 열 수 있고, 사람 시점은 표시하지 않습니다. 로컬 작업실의 다른 공간과 사람 시점은 계속 사용할 수 있습니다. 발표 파일만 갱신하려면 `npm run export:presentation`을 실행해 **[exports/건조실-발표용.html](exports/건조실-발표용.html)**을 만드세요. 아래 `export:share`는 전체 작업실을 담는 별도 공유본입니다.

현재 게시 소스는 `sites/dryer-presentation-20261112/.sites-checkout/`이며, [게시 기록](docs/dryer-presentation-20261112.json)에 버전·커밋·공유 범위를 남겼습니다.

~~~powershell
npm run assets:index   # 자산 목록을 바꾼 뒤 CSV 갱신
npm run check          # 문법·파일 경로·자산 등록·CSV 확인
npm test               # 3D·도면 검토·공유 동작 확인
npm run export:share   # 공유 HTML 갱신
~~~

이미지만 검사하려면 `npm run assets:check`를 사용합니다. 공유 결과는 **[exports/건조기-통합-공유.html](exports/건조기-통합-공유.html)** 하나이며 3D 모델을 오프라인으로 엽니다. 도면 검토 서버·원본·DB는 로컬 작업실에서 사용합니다. 공유 파일 생성은 온라인 게시본을 자동 변경하지 않습니다.

모델 설비 ID와 기존 배치 저장 키는 유지합니다. 같은 브라우저·프로토콜·호스트·포트에서 저장한 배치를 복원하며, 옮길 때는 화면의 배치 파일 저장·불러오기를 사용하세요.

소스와 검증 자료는 비공개 [dryer-workspace 저장소](https://github.com/minhyun133601-arch/dryer-workspace)에 보관합니다. 대용량 촬영 원본, `근거 자료/건물3D 후보도면/`의 원본 CAD, 도면 검토 캐시와 접근 토큰·실행 상태는 로컬에 보존하고 Git에서 제외합니다. CAD 목록 `00_*`, 영상 출처·해시·판독 기록, 참고 프레임과 검증 캡처는 저장소에 포함합니다. 공유 HTML은 `exports/`에 생성하며 위 내보내기 명령으로 다시 만들 수 있습니다.

11/12에 참고 사진·영상·다른 팀 카드를 바탕화면 `삭제 예정/프로젝트_자료정리_20261112/`로 옮긴 내역은 [기존 정리 목록](workspace/cleanup-20261112/move-plan.json)에 있습니다. 3팀 원본 카드 66건·첨부 200파일과 통합 PDF, 도면 검토자료는 계속 보존합니다. 별도 보류한 모터·제어판·열교환기 기능의 위치와 이전 작업 세부 내용은 변경 기록에 남겼습니다.
