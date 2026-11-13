(() => {
  const drawing = window.PanelAtlas.drawing;
  const { screw, part } = drawing.primitives;

  function buildPowerControl() {
    let body = "";
    // Secondary supply and six independent floatless level controls.
    body += part(
      "power-01",
      "DC 전원공급기",
      210,
      626,
      89,
      83,
      `<g filter="url(#moduleShadow)"><path d="M213 626h82l4 7h-89z" fill="#a1aa95"/><path d="M214 627h78v5h-78z" fill="url(#vents)"/><rect x="210" y="633" width="89" height="76" rx="1" fill="#9f694e" stroke="#75513c"/><rect x="210" y="686" width="89" height="23" fill="#263b2b"/><text x="254.5" y="654" text-anchor="middle" font-size="8.5" font-weight="650" fill="#eee5cc" font-family="sans-serif">Weidmüller</text><text x="254.5" y="664" text-anchor="middle" font-size="4.8" fill="#dcc8ad">POWER SUPPLY</text><path d="M217 675h68M217 679h51" stroke="#c39774" stroke-width=".7"/><circle cx="287" cy="692" r="2" fill="#adce6b"/>${Array.from({ length: 7 }, (_, i) => screw(217 + i * 12.2, 704, 2)).join("")}</g>`,
    );
    for (let i = 0; i < 6; i++) {
      const x = 307 + i * 46;
      body += part(
        `level-0${i + 1}`,
        `수위 제어기 ${i + 1}`,
        x,
        639,
        43,
        68,
        `<g filter="url(#moduleShadow)"><rect x="${x}" y="639" width="43" height="68" rx="2" fill="#e1e1cd" stroke="#a2aa90" stroke-width=".7"/><text x="${x + 5}" y="650" font-size="6.4" font-weight="700" fill="#394a37">Koino</text><circle cx="${x + 35}" cy="647" r="2" fill="#8d4d37"/><text x="${x + 5}" y="659" font-size="4.4" fill="#53644c" font-family="monospace">KFS-PC8</text><rect x="${x + 4}" y="664" width="35" height="35" fill="#263e36"/><path d="M${x + 10} 673h22v12h-22zM${x + 8} 679h6m13 0h7M${x + 17} 669v20M${x + 24} 669v20" stroke="#b5c1aa" stroke-width=".7"/><path d="M${x + 8} 693h27M${x + 8} 695h19" stroke="#8fa28b" stroke-width=".6"/><path d="M${x + 5} 704h32" stroke="#87967b" stroke-width=".6"/></g>`,
      );
    }
    return body;
  }

  drawing.sections["power-control"] = buildPowerControl;
})();
