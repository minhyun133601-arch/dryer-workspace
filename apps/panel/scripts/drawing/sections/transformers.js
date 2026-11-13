(() => {
  const drawing = window.PanelAtlas.drawing;
  const { screw, part } = drawing.primitives;

  function buildTransformers() {
    let body = "";
    // Bottom transformer bank is one visual item; actual rating awaits its nameplate.
    let trans = '<g filter="url(#moduleShadow)">';
    for (let i = 0; i < 3; i++) {
      const x = [213, 334, 473][i],
        w = [98, 116, 107][i],
        mid = x + w / 2;
      trans += `<rect x="${x + 4}" y="979" width="${w - 8}" height="48" rx="1.5" fill="#465248"/><path d="M${x + 8} 982h${w - 16}M${x + 8} 985h${w - 16}M${x + 8} 1020h${w - 16}M${x + 8} 1023h${w - 16}" stroke="#75806b" stroke-width=".8"/><rect x="${x}" y="989" width="${w}" height="10" fill="#727e68"/><rect x="${mid - 23}" y="978" width="46" height="48" fill="#d5d5b8" stroke="#8f9b7f"/><path d="M${mid - 19} 983v38M${mid - 13} 983v38M${mid - 7} 983v38M${mid - 1} 983v38M${mid + 5} 983v38M${mid + 11} 983v38M${mid + 17} 983v38" stroke="#b9b9a0" stroke-width="1.5"/><rect x="${mid - 18}" y="969" width="36" height="10" rx="1" fill="#2d4032"/>${screw(mid - 10, 974, 2.3)}${screw(mid + 10, 974, 2.3)}<rect x="${mid - 16}" y="1017" width="32" height="6" fill="#cdc27b"/>${screw(x + 8, 994, 2.3)}${screw(x + w - 8, 994, 2.3)}`;
    }
    body += part(
      "transformer-01",
      "제어용 변압기",
      213,
      969,
      367,
      58,
      trans + "</g>",
    );
    return body;
  }

  drawing.sections["transformers"] = buildTransformers;
})();
