// The six-digit file stem is the capture time on the original 20261125 JPEG.
function surveyPhotos(area, entries) {
  return entries.map(([time, label]) => ({
    id: area + '-20261125-' + time,
    path: './assets/photos/evidence/' + area + '-20261125/' + time + '.jpg',
    category: 'survey-' + area,
    label,
  }));
}

export const PREPARATION_CONSOLE_PHOTOS = surveyPhotos('dryer-preparation-console', [
  ['090209', '조제실 조작반 정면 · 경사 조작면과 상단 터치화면'],
  ['090201', '조제실 작업대 전경 · 왼쪽 조작반과 오른쪽 탱크 열'],
  ['090207', '조작반 왼쪽 · 독립 모니터, 전화기와 기록대'],
  ['090231', '수직 표시판 · 자석으로 부착한 점검 카드'],
  ['090218', '계통도 중앙 · 탱크 기호와 표시등'],
  ['090216', '계통도 오른쪽 · 숫자 표시창과 선택 스위치'],
  ['090257', '조작반 옆면 · 경사판의 깊이와 작업대 난간'],
  ['090319', '작업대 아래에서 본 계단, 난간과 지지 구조'],
]);

export const OFFICE_ROOF_PHOTOS = surveyPhotos('office-rooftop-power', [
  ['085718', '공무사무실 옥상 · 낮은 철골 가대와 밝은색 기기'],
  ['085723', '한전 전력계 구역 전경 · 전면 철골 프레임과 회색 함체'],
]);
