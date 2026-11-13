(() => {
  const drawing = window.PanelAtlas.drawing;
  const { screw, part } = drawing.primitives;

  function buildProtection() {
    let body = "";
    // Circuit protectors, grouped as one maintenance item.
    let protect = `<g filter="url(#moduleShadow)"><rect x="210" y="520" width="31" height="49" fill="#c0c8ba" stroke="#7a8871"/>${screw(217, 525)}${screw(234, 525)}<rect x="216" y="536" width="18" height="21" rx="1" fill="#344337"/><path d="M216 548h18" stroke="#be6148" stroke-width="3"/><path d="M213 563h25" stroke="#6f7c65"/>`;
    for (let i = 0; i < 12; i++) {
      const x = 246 + i * 28.1;
      protect += `<rect x="${x}" y="523" width="26" height="43" rx=".8" fill="url(#breakerBody)" stroke="#87967e" stroke-width=".6"/>${screw(x + 7, 526, 2)}${screw(x + 20, 526, 2)}<rect x="${x + 1}" y="532" width="24" height="5" fill="#a84935"/><path d="M${x + 3} 542h20M${x + 3} 545h16M${x + 3} 550h20M${x + 3} 553h13" stroke="#8f9985" stroke-width=".65"/>${screw(x + 7, 563, 2)}${screw(x + 20, 563, 2)}`;
    }
    body += part(
      "protect-01",
      "회로보호기 뱅크",
      210,
      520,
      373,
      49,
      protect + "</g>",
    );
    return body;
  }

  drawing.sections["protection"] = buildProtection;
})();
