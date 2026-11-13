(() => {
  const drawing = window.PanelAtlas.drawing;
  const { rail, wire, wireBank, duct } = drawing.primitives;

  function buildWiring() {
    return `    <g aria-hidden="true">
      <rect x="179" y="55" width="18" height="995" fill="#8d998f"/>
      <rect x="592" y="55" width="19" height="995" fill="#8d998f"/>
      ${Array.from({ length: 78 }, (_, i) => `<path d="M178 ${61 + i * 12.6}h20M592 ${61 + i * 12.6}h20" stroke="#4b5b50" stroke-width="4.5"/>`).join("")}
      <path d="M185 56v990M603 56v990" stroke="#c4cec0" stroke-width="5"/>
      ${rail(210, 130, 374)}
      ${rail(211, 546, 373)}
      ${rail(210, 682, 374)}
      ${rail(211, 793, 373)}
      ${wireBank(309, 80, 99, 8, 17.5)}
      ${wireBank(309, 170, 194, 8, 17.5)}
      ${wire(225, 80, 225, 99, "#554f79", 0, 3.2)}
      ${wire(229, 174, 229, 194, "#554f79", 0, 3.2)}
      ${wire(546, 80, 546, 128, "#883827", 0, 2)}
      ${wire(559, 80, 559, 128, "#264779", 0, 2)}
      ${wire(548, 174, 548, 194, "#883827", 0, 2)}
      ${wire(561, 174, 561, 194, "#264779", 0, 2)}
      ${wireBank(217, 217, 235, 4, 10)}
      ${Array.from({ length: 12 }, (_, i) => Array.from({ length: 4 }, (_, j) => wire(293 + i * 24.2 + j * 3.2, 450, 297 + i * 24.2 + j * 3.2, 480, "#235780", 9, 1.7)).join("")).join("")}
      ${wire(261, 369, 257, 479, "#4a9bba", -15, 3)}
      ${wireBank(218, 503, 521, 25, 14.5)}
      ${wireBank(218, 567, 586, 25, 14.5)}
      ${wireBank(221, 611, 629, 25, 14.1)}
      ${wireBank(221, 709, 727, 25, 14.1)}
      ${wireBank(218, 752, 766, 28, 13.1)}
      ${wireBank(218, 813, 834, 28, 13.1)}
      ${wireBank(215, 858, 874, 35, 10.65)}
      ${wireBank(215, 912, 931, 35, 10.65)}
      ${wireBank(226, 955, 973, 11, 31)}
    </g>
    ${duct(56, ["A3 Q7", "A3 Q8", "A4 Q9", "A4 Q10"])}
    ${duct(193, ["A4 P1", "PLC POWER"])}
    ${duct(479, ["A301", "A302", "A303", "A401", "A402", "A403", "A404", "A405"])}
    ${duct(586, ["H500P1", "A4G1", "E303P1", "E304P1", "E305P1", "E312P1"])}
    ${duct(727, ["A10K1", "H500K1", "A3K1", "A1K1", "SPARE", "A50F1", "A8S1"])}
    ${duct(834, ["A6A1", "A6A2", "A6A3"])}
    ${duct(931, ["X01", "X02", "X03"])}
    ${duct(1038, ["POWER TRANSFORMER"])}
  `;
  }

  drawing.buildWiring = buildWiring;
})();
