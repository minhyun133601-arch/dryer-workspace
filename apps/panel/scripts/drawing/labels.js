(() => {
  const drawing = window.PanelAtlas.drawing;
  const { label } = drawing.primitives;

  function buildLabels() {
    return `    ${label("01", "전원·통신", 131)}
    ${label("02", "PLC 시스템", 336)}
    ${label("03", "회로 보호", 541)}
    ${label("04", "전원·수위", 663)}
    ${label("05", "릴레이", 783)}
    ${label("06", "단자대", 887)}
    ${label("07", "변압기", 994)}
`;
  }

  drawing.buildLabels = buildLabels;
})();
