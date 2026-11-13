(() => {
  const drawing = window.PanelAtlas.drawing;
  const { screw, part } = drawing.primitives;

  function buildTerminals() {
    let body = "";
    // Terminal strips, individually selectable as their three physical banks.
    for (let i = 0; i < 3; i++) {
      const x = 210 + i * 126;
      let terminal = `<g filter="url(#moduleShadow)"><rect x="${x}" y="874" width="116" height="38" fill="#a4ad94" stroke="#75896b"/><path d="M${x} 880h116M${x} 905h116" stroke="#d7dbc4" stroke-width="5"/>`;
      for (let j = 0; j < 15; j++) {
        const tx = x + 3 + j * 7.4;
        terminal += `<rect x="${tx}" y="883" width="6.5" height="19" fill="${j % 2 ? "#5e7850" : "#71885c"}" stroke="#394e36" stroke-width=".5"/>${screw(tx + 3.2, 878, 1.5)}${screw(tx + 3.2, 908, 1.5)}`;
      }
      terminal += `<path d="M${x + 3} 882h110" stroke="${i === 0 ? "#ce7670" : "#a6bb92"}" stroke-width="2"/></g>`;
      body += part(
        `terminal-0${i + 1}`,
        `단자대 ${i + 1}`,
        x,
        874,
        116,
        38,
        terminal,
      );
    }
    return body;
  }

  drawing.sections["terminals"] = buildTerminals;
})();
