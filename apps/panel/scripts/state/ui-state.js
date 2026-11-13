(() => {
  "use strict";
  window.PanelAtlas.state.createUIState = function (parts, config) {
    const initial =
      parts.find((part) => part.id === config.initialSelectedId) || parts[0];
    return {
      selectedId: initial?.id ?? null,
      filter: "all",
      query: "",
      detailTab: "info",
      mode: "diagram",
      zoom: config.initialZoom,
      editingId: null,
    };
  };
})();
