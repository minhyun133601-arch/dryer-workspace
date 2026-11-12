# OWP 건조기 2팀 참고 자료

**[index.html](index.html)을 크롬으로 열면 층별 이미지와 애니메이션을 볼 수 있습니다.** 폴더 전체를 함께 보관하면 OWP 서버 연결 없이 열람할 수 있습니다.

원본 화면: <http://192.168.2.113/pages/C101000>  
보관 날짜: 2026-10-29 (한국시간)

| 화면 | OWP 선택값 | 원본 애니메이션 | 대표 이미지 |
|---|---|---|---|
| 2팀 전체 | 1 | [heechang_0529.webm](originals/assets/models/heechang_0529.webm) | [team2.png](images/team2.png) |
| 2팀 1층 | 2 | [heechang_0425_1F.webm](originals/assets/models/heechang_0425_1F.webm) | [floor1.png](images/floor1.png) |
| 2팀 3층 | 3 | [heechang_0428_3FCloseup.webm](originals/assets/models/heechang_0428_3FCloseup.webm) | [floor3.png](images/floor3.png) |
| 2팀 4층 | 34 | [heechang_0428_3F4F.webm](originals/assets/models/heechang_0428_3F4F.webm) | [floor4.png](images/floor4.png) |
| 2팀 5~7층 | 57 | [heechang_0428_5F7F.webm](originals/assets/models/heechang_0428_5F7F.webm) | [floor5-7.png](images/floor5-7.png) |

## 저장 내용

- **원본 애니메이션**: 위 5개 모두 1920×1080 WebM(VP8). OWP의 해당 화면 소스에는 SWF 참조가 없으며 실제 영상 형식은 WebM입니다. 인트로 영상도 추가 보관했습니다.
- **영상 이미지**: 각 영상의 6초 대표 프레임 5장과 0·1·2·3·6·8.7초 과정 30장, 총 PNG 35장. 층별 6컷 JPG 5개와 전체 모아보기 JPG도 있습니다. 이 이미지에는 React로 별도 표시하는 수치·게이지가 포함되지 않습니다.
- **배치 참고 화면**: `snapshots/`의 HTML·PNG와 배치 JSON. 원본 React JSX/CSS, 영상 프레임, 저장된 표시값을 결합한 오프라인 출력입니다. 실제 크롬 화면 캡처와 구분해 사용하세요. 게이지는 영역 표시로 대체했고 팝업·시계·일부 실적값은 생략했습니다. 미확보 표시값은 공백 또는 대시입니다.
- **원본 화면 소스**: 모니터링 JSX 11개와 배포된 JS/CSS. 원본은 `originals/`에 보관했습니다. JSX는 React·MUI·video-react·amCharts 등의 실행 의존성을 별도로 요구합니다.
- **재현 메모**: [화면구성_재현메모.md](화면구성_재현메모.md)에 층 선택값, 영상 반복 구간, 센서 태그·단위·좌표와 원본 화면의 특이점을 기록했습니다.
- **조회값**: `data/monitoring-snapshot.json`·CSV에 **2026-10-29 14:15:24 KST 저장한 응답 74행**을 보관했습니다. 각 센서의 `TIMESTAMP`는 응답 저장 시각과 별개입니다. 이 값은 현재 운전값이 아닙니다. 열람 페이지는 서버와 연결되지 않습니다.

## 확인 사항과 한계

다섯 대표 PNG가 올바른 영상의 6초 프레임과 픽셀 단위로 일치하는지 확인했습니다. 다섯 영상의 크기·길이·브라우저 열람과 층 선택 동작도 확인했습니다. 원본 자산 22개의 크기·SHA-256 해시는 [manifest.json](manifest.json)에 있습니다.

로그인된 기존 크롬 세션은 도구 연결 문제로 직접 캡처하지 못했습니다. 여기에는 원본 영상과 영상에서 추출한 이미지, 소스에서 출력한 배치 참고 화면이 들어 있습니다.

원본 CSS가 참조하는 `/assets/images/lights/g.png`, `y.png`는 서버가 이미지 대신 HTML을 반환해 확보하지 못했습니다. 실패 내역은 `manifest.json`의 `unavailable`에 기록했습니다. 저장한 5개 영상과 기본 프레임 열람에는 영향이 없습니다.

재생성 스크립트는 `tooling/`에 있습니다. 단순 열람에는 Python·Node·추가 설치가 필요하지 않습니다.
