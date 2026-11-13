(() => {
  const drawing = window.PanelAtlas.drawing;
  const { screw } = drawing.primitives;

  function buildFrame() {
    return `    <g filter="url(#cabShadow)">
      <rect x="153" y="14" width="485" height="1052" rx="6" fill="url(#frameMetal)" stroke="#89958c" stroke-width="1.4"/>
      <rect x="174" y="39" width="442" height="1017" rx="2" fill="#6c756b"/>
      <rect x="181" y="44" width="428" height="1008" fill="url(#panelOrange)" stroke="#a65e32"/>
      <rect x="155" y="14" width="481" height="16" rx="4" fill="#b2bbb1"/>
      <text x="395" y="25" font-size="7.5" text-anchor="middle" fill="#68746b" letter-spacing="2" font-family="monospace">CONTROL PANEL / 01</text>
      ${[35, 210, 500, 775, 1049].map((y) => screw(164, y, 3.2) + screw(626, y, 3.2)).join("")}
      <path d="M171 53v981M621 53v981" stroke="#d3dad0" stroke-opacity=".8"/>
    </g>
`;
  }

  drawing.buildFrame = buildFrame;
})();
