(() => {
  const drawing = window.PanelAtlas.drawing;

  function buildDefinitions() {
    return `
  <svg xmlns="http://www.w3.org/2000/svg" class="cabinet-svg" viewBox="0 0 ${drawing.size.width} ${drawing.size.height}" fill="none" aria-label="사진을 참고해 재현한 제어반 부품 배치도">
    <defs>
      <linearGradient id="panelOrange" x1="180" y1="50" x2="600" y2="1050" gradientUnits="userSpaceOnUse"><stop stop-color="#de8745"/><stop offset=".35" stop-color="#d17938"/><stop offset="1" stop-color="#bc652c"/></linearGradient>
      <linearGradient id="frameMetal" x1="150" y1="0" x2="644" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#7d8781"/><stop offset=".045" stop-color="#b8c0b8"/><stop offset=".08" stop-color="#737e77"/><stop offset=".92" stop-color="#a5ada5"/><stop offset=".96" stop-color="#c5ccc3"/><stop offset="1" stop-color="#7d8980"/></linearGradient>
      <linearGradient id="ductMetal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d6dbd3"/><stop offset=".45" stop-color="#b5beb4"/><stop offset="1" stop-color="#a5afa5"/></linearGradient>
      <linearGradient id="railMetal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e1e6dd"/><stop offset=".45" stop-color="#929e92"/><stop offset="1" stop-color="#d4dbd0"/></linearGradient>
      <linearGradient id="plcBody" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#2e3a36"/><stop offset=".35" stop-color="#43504a"/><stop offset="1" stop-color="#283630"/></linearGradient>
      <linearGradient id="moduleBody" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#172b29"/><stop offset=".12" stop-color="#3d4c45"/><stop offset=".9" stop-color="#34423b"/><stop offset="1" stop-color="#172c26"/></linearGradient>
      <linearGradient id="breakerBody" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#c8cfc3"/><stop offset=".15" stop-color="#eef0e7"/><stop offset=".75" stop-color="#e0e5d9"/><stop offset="1" stop-color="#bbc5b7"/></linearGradient>
      <linearGradient id="clearRelay" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d6d8c6" stop-opacity=".9"/><stop offset=".45" stop-color="#8c9685" stop-opacity=".8"/><stop offset="1" stop-color="#d5dbcd" stop-opacity=".9"/></linearGradient>
      <pattern id="vents" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.1" fill="#27342c"/></pattern>
      <filter id="cabShadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="6" dy="9" stdDeviation="9" flood-color="#263f31" flood-opacity=".12"/></filter>
      <filter id="moduleShadow" x="-15%" y="-10%" width="140%" height="135%"><feDropShadow dx="1.4" dy="2.2" stdDeviation="1.2" flood-color="#5b351d" flood-opacity=".35"/></filter>
    </defs>
    <style>
      .cabinet-svg .part-hit{outline:none;transition:opacity .16s}
      .cabinet-svg .part-hit .hit-outline{transition:stroke .16s,fill .16s;pointer-events:all}
      .cabinet-svg .part-hit:hover .hit-outline{stroke:#59a69e;fill:#9ed6cc18}
      .cabinet-svg .part-hit:focus-visible .hit-outline{stroke:#087969;stroke-width:3.2}
      .cabinet-svg .part-hit.is-selected .hit-outline{stroke:#008a77;fill:#68dec525}
      .cabinet-svg .part-hit.is-muted{opacity:.24}
      .cabinet-svg text{user-select:none;pointer-events:none}
    </style>
`;
  }

  drawing.buildDefinitions = buildDefinitions;
})();
