(() => {
  const drawing = window.PanelAtlas.drawing;
  const { screw, part } = drawing.primitives;

  function buildPLC() {
    let body = "";
    // PLC rack; the teal terminal covers recall the user's Siemens installation.
    body += `<g aria-hidden="true"><rect x="207" y="230" width="379" height="226" rx="1.5" fill="#1c2d27"/><path d="M210 233h373M210 453h373" stroke="#59675b" stroke-width="2"/></g>`;
    body += part(
      "plc-power",
      "PLC 전원 모듈",
      209,
      235,
      43,
      219,
      `<g filter="url(#moduleShadow)"><rect x="209" y="235" width="43" height="219" rx="1" fill="url(#plcBody)" stroke="#1f3027"/>${screw(216, 242)}${screw(246, 242)}<rect x="213" y="250" width="35" height="11" fill="#459c96"/><text x="230.5" y="258" text-anchor="middle" font-size="7" font-weight="700" fill="#eef7ec" font-family="sans-serif">SIEMENS</text><path d="M213 269h17M213 272h13" stroke="#78897a" stroke-width=".8"/>${Array.from({ length: 8 }, (_, i) => `<rect x="214" y="${282 + i * 6}" width="2.5" height="3.5" fill="${i > 5 ? "#b9cd6c" : "#65765d"}"/><path d="M219 ${284 + i * 6}h11" stroke="#6d7e65" stroke-width=".6"/>`).join("")}<rect x="212" y="342" width="37" height="74" fill="#25382b" stroke="#58694f" stroke-width=".6"/><rect x="217" y="351" width="11" height="44" rx="2" fill="#dddccc"/><rect x="232" y="351" width="11" height="44" rx="2" fill="#e6e4d5"/><rect x="217" y="383" width="11" height="12" fill="#467350"/><rect x="232" y="383" width="11" height="12" fill="#467350"/><path d="M220 356v21M235 356v21" stroke="#9ca696" stroke-width="1"/><text x="230.5" y="431" text-anchor="middle" font-size="5" fill="#94a18b">POWER</text><path d="M215 440h31M215 443h31" stroke="#74846b" stroke-width=".6"/></g>`,
    );
    body += part(
      "plc-cpu",
      "PLC CPU",
      254,
      235,
      32,
      219,
      `<g filter="url(#moduleShadow)"><rect x="254" y="235" width="32" height="219" fill="url(#plcBody)" stroke="#1c2c23"/>${screw(261, 242)}${screw(280, 242)}<rect x="272" y="257" width="9" height="74" rx="1" fill="#98d1c8"/><text x="279" y="322" transform="rotate(-90 279 322)" font-size="5.7" fill="#416b61" font-family="monospace">CPU MODULE</text>${Array.from({ length: 9 }, (_, i) => `<rect x="258" y="${272 + i * 6.6}" width="2.8" height="3.5" fill="${i < 5 ? "#d6e78a" : "#788a61"}"/>`).join("")}<rect x="259" y="341" width="8" height="7" rx="1" fill="#182a22"/><path d="M261 342v5" stroke="#a2aa96"/><rect x="258" y="364" width="23" height="26" fill="#1b2b24" stroke="#596956" stroke-width=".8"/><rect x="261" y="370" width="17" height="11" fill="#253f33" stroke="#b1c0a6" stroke-width="1"/><path d="M263 372h13" stroke="#8fa987" stroke-dasharray="1.1 1"/><path d="M259 400h22M259 404h22M259 408h22" stroke="#77866e" stroke-width=".6"/><text x="270" y="431" text-anchor="middle" font-size="5.8" fill="#b3c0a9">CPU</text></g>`,
    );
    for (let i = 0; i < 12; i++) {
      const x = 289 + i * 24.5;
      const id = `plc-io-${String(i + 1).padStart(2, "0")}`;
      const type = i === 0 ? "CP" : i === 1 ? "DI" : "I/O";
      body += part(
        id,
        i === 0 ? "PLC 통신 프로세서 CP 443-1" : `PLC 입출력 모듈 ${String(i + 1).padStart(2, "0")}`,
        x,
        235,
        22.5,
        219,
        `<g filter="url(#moduleShadow)"><rect x="${x}" y="235" width="22.5" height="219" fill="url(#moduleBody)" stroke="#192a24" stroke-width=".6"/>${screw(x + 15, 243, 2.8)}<text x="${x + 4}" y="245" font-size="5" fill="#8c9b86" font-family="monospace">${i + 3}</text><rect x="${x + 9}" y="261" width="10.5" height="178" rx=".6" fill="${i % 3 === 2 ? "#8dbdb8" : "#a3d2cb"}"/><path d="M${x + 9} 284h10.5M${x + 9} 311h10.5M${x + 9} 338h10.5M${x + 9} 365h10.5M${x + 9} 392h10.5M${x + 9} 419h10.5" stroke="#5f9c92" stroke-width=".8"/>${Array.from({ length: 17 }, (_, j) => `<rect x="${x + 3}" y="${272 + j * 9.2}" width="2.4" height="3.7" fill="${(i + j) % 4 < 2 ? "#d5e987" : "#5e7550"}"/>`).join("")}<text x="${x + 14.2}" y="277" text-anchor="middle" font-size="5" fill="#417769" font-family="monospace">${type}</text><path d="M${x + 12} 296h4M${x + 12} 304h4M${x + 12} 321h4M${x + 12} 329h4M${x + 12} 349h4M${x + 12} 357h4M${x + 12} 375h4M${x + 12} 383h4M${x + 12} 403h4M${x + 12} 411h4" stroke="#628f84" stroke-width=".5"/><rect x="${x + 8}" y="442" width="12" height="12" rx="1" fill="#173d53"/><path d="M${x + 11} 445v9M${x + 14} 445v9M${x + 17} 445v9" stroke="#40719a" stroke-width="1.4"/></g>`,
      );
    }
    return body;
  }

  drawing.sections["plc"] = buildPLC;
})();
