(() => {
  const drawing = window.PanelAtlas.drawing;
  const { screw, part } = drawing.primitives;

  function buildUpper() {
    let body = "";
    // Upper rail: communication repeater, protection and auxiliary breaker.
    body += part(
      "comm-01",
      "통신 리피터",
      209,
      98,
      42,
      77,
      `
    <g filter="url(#moduleShadow)"><rect x="209" y="98" width="42" height="77" rx="2" fill="#29362d" stroke="#18251c"/><rect x="212" y="101" width="36" height="14" fill="#455247"/>${screw(217, 106)}${screw(242, 106)}<rect x="218" y="121" width="15" height="27" rx="2" fill="#111b19" stroke="#b4bcaf" stroke-width="1.1"/><path d="M221 126v16M225 126v16M229 126v16" stroke="#657367" stroke-dasharray="1 3" stroke-width="1.3"/><rect x="239" y="122" width="4" height="4" fill="#d6a857"/><rect x="239" y="132" width="4" height="4" fill="#62a9ba"/><rect x="239" y="143" width="4" height="4" fill="#a7c775"/><path d="M214 155h31M214 159h31" stroke="#7e8f7b" stroke-width=".5"/>${screw(217, 167)}${screw(242, 167)}</g>`,
    );
    body += `<g aria-hidden="true"><rect x="266" y="103" width="21" height="68" rx="1.5" fill="#c0c8b7" stroke="#8b997e"/><rect x="267" y="103" width="19" height="11" fill="#cd8a48"/><rect x="267" y="160" width="19" height="11" fill="#cd8a48"/>${[272, 281].map((x) => screw(x, 108) + screw(x, 165)).join("")}<path d="M271 118h11v36h-11zM273 123h7M273 129h7M273 135h7M273 141h7" stroke="#63725d" stroke-width=".6"/></g>`;
    for (let i = 0; i < 4; i++) {
      const x = 296 + i * 36.5;
      body += part(
        `mcb-0${i + 1}`,
        `차단기 ${i + 1}`,
        x,
        99,
        35,
        73,
        `<g filter="url(#moduleShadow)"><rect x="${x}" y="99" width="35" height="73" rx="1.5" fill="url(#breakerBody)" stroke="#8d9a86" stroke-width=".7"/><path d="M${x + 17.5} 100v25M${x + 17.5} 151v20" stroke="#acb7a4"/>${screw(x + 9, 107, 3.2)}${screw(x + 26, 107, 3.2)}${screw(x + 9, 164, 3.2)}${screw(x + 26, 164, 3.2)}<path d="M${x + 3} 117h29" stroke="#4a9d7d" stroke-width="2"/><text x="${x + 4}" y="125" font-size="4.5" fill="#568064" font-family="sans-serif">Schneider</text><rect x="${x + 2}" y="134" width="31" height="15" rx="2" fill="#152a28"/><path d="M${x + 4} 137h27" stroke="#51625a"/><rect x="${x + 6}" y="139" width="23" height="5" rx="1" fill="#273d37"/><text x="${x + 17.5}" y="154" text-anchor="middle" font-size="3.7" fill="#85907d" font-family="monospace">CIRCUIT BREAKER</text></g>`,
      );
    }
    body += part(
      "aux-01",
      "보조 차단기",
      542,
      128,
      38,
      45,
      `<g filter="url(#moduleShadow)"><rect x="542" y="128" width="38" height="45" rx="2" fill="url(#breakerBody)" stroke="#899581"/>${screw(551, 132, 2.6)}${screw(571, 132, 2.6)}<rect x="546" y="137" width="30" height="25" fill="#edf0e3" stroke="#a7b09e"/><path d="M546 156h30" stroke="#bc5541" stroke-width="4"/><text x="561" y="146" text-anchor="middle" font-size="4.6" fill="#6c7b64">AUX</text>${screw(551, 168, 2.4)}${screw(571, 168, 2.4)}</g>`,
    );
    return body;
  }

  drawing.sections["upper"] = buildUpper;
})();
