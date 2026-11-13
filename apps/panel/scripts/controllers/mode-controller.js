(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.controllers.createModeController = function (context) {
    const { state } = context;
    const { $ } = context.utils;

    function setMode(next) {
      if (!["diagram", "photo"].includes(next)) return;
      state.mode = next;
      $("#drawingWrap").hidden = state.mode !== "diagram";
      $("#referenceWrap").hidden = state.mode !== "photo";
      $("#viewTitle").textContent =
        state.mode === "diagram"
          ? "제어반 정면도"
          : context.referencePhoto.title;
      $("#zoomControls").style.visibility =
        state.mode === "diagram" ? "visible" : "hidden";
      $(".canvas-caption").style.visibility =
        state.mode === "diagram" ? "visible" : "hidden";
      $("#diagramMode").classList.toggle("active", state.mode === "diagram");
      $("#photoMode").classList.toggle("active", state.mode === "photo");
      $("#diagramMode").setAttribute("aria-pressed", state.mode === "diagram");
      $("#photoMode").setAttribute("aria-pressed", state.mode === "photo");
      context.controllers.photo.updateReferenceLayout();
      if (state.mode === "diagram") context.controllers.viewport.updateZoom();
    }
    return { setMode };
  };
})();
