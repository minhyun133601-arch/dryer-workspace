(() => {
  "use strict";
  const categories = {
    plc: { title: "PLC 시스템", icon: "chip" },
    power: { title: "전원 · 통신", icon: "bolt" },
    control: { title: "릴레이 · 수위 제어", icon: "control" },
    terminal: { title: "단자대", icon: "terminal" },
  };
  const editableKeys = [
    "name",
    "brand",
    "model",
    "rating",
    "docsUrl",
    "sellerName",
    "sellerUrl",
    "notes",
  ];

  window.PanelAtlas.config = {
    storageKey: "panel-atlas-part-info-v1",
    initialSelectedId: "plc-cpu",
    initialZoom: 1.75,
    zoomMin: 0.75,
    zoomMax: 2,
    zoomStep: 0.25,
    categories,
    editableKeys,
  };
})();
