(() => {
  const drawing = window.PanelAtlas.drawing;
  const { screw, part } = drawing.primitives;

  function buildRelays() {
    let body = "";
    // Contactor and clear relays.
    body += part(
      "contactor-01",
      "전자접촉기",
      210,
      766,
      51,
      49,
      `<g filter="url(#moduleShadow)"><rect x="210" y="766" width="51" height="49" rx="1.2" fill="#d8ddcc" stroke="#809174"/><rect x="215" y="769" width="41" height="8" fill="#35472e"/>${[220, 235, 250].map((x) => screw(x, 773, 2.1)).join("")}<path d="M216 783h13v17h-13zM242 783h13v17h-13z" fill="#a4af98"/><rect x="230" y="784" width="11" height="11" fill="#92633e"/><text x="235.5" y="806" font-size="6" text-anchor="middle" fill="#4d6041" font-weight="600">LS</text>${[220, 235, 250].map((x) => screw(x, 812, 2.1)).join("")}</g>`,
    );
    let relays = '<g filter="url(#moduleShadow)">';
    for (let i = 0; i < 11; i++) {
      const x = 271 + i * 23.6;
      relays += `<rect x="${x}" y="769" width="21" height="45" rx="1" fill="#5a6651"/><rect x="${x + 1}" y="770" width="19" height="39" rx="1.2" fill="url(#clearRelay)" stroke="#cbd2bd" stroke-width=".8"/><path d="M${x + 5} 776h11v16h-11zM${x + 7} 778v12M${x + 11} 778v12M${x + 15} 778v12" stroke="#796f51" stroke-width=".8"/><circle cx="${x + 10.5}" cy="782" r="3.2" fill="none" stroke="#d6ddc5" stroke-width="1"/><rect x="${x + 1}" y="795" width="19" height="6" fill="#b65d3d"/><path d="M${x + 4} 805h12" stroke="#d6d9c2" stroke-width=".8"/>${screw(x + 6, 772, 1.4)}${screw(x + 15, 772, 1.4)}`;
    }
    body += part(
      "relay-01",
      "HY-F15 퓨즈홀더·릴레이 그룹",
      271,
      769,
      257,
      45,
      relays + "</g>",
    );
    body += part(
      "thermo-01",
      "판넬 온도조절기",
      548,
      765,
      34,
      51,
      `<g filter="url(#moduleShadow)"><rect x="548" y="765" width="34" height="51" rx="2" fill="#e8e5cd" stroke="#abb096"/><circle cx="565" cy="783" r="13" fill="#eeecd7" stroke="#9da68a"/><circle cx="565" cy="783" r="5.7" fill="#d8d6bb"/>${Array.from(
        { length: 11 },
        (_, i) => {
          const a = ((-140 + i * 28) * Math.PI) / 180;
          return `<path d="M${565 + 10 * Math.cos(a)} ${783 + 10 * Math.sin(a)}l${1.5 * Math.cos(a)} ${1.5 * Math.sin(a)}" stroke="#5f6f55" stroke-width=".7"/>`;
        },
      ).join(
        "",
      )}<path d="M565 783l4-6" stroke="#5c6e51" stroke-width="1.4"/><path d="M554 800h22M554 803h22M554 806h22" stroke="#b3b798" stroke-width=".8"/>${screw(558, 812, 2)}${screw(573, 812, 2)}</g>`,
    );
    return body;
  }

  drawing.sections["relays"] = buildRelays;
})();
