(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.controllers.createViewportController = function (context) {
    const { state, config } = context;
    const { $, partSelector } = context.utils;

    function revealPart(id) {
      const wrap = $("#drawingWrap");
      const hit = $(`#cabinetDrawing ${partSelector(id)}`);
      if (!hit) return;
      const viewport = wrap.getBoundingClientRect();
      const bounds = hit.getBoundingClientRect();
      const inset = 24;
      const top = bounds.top - viewport.top;
      const bottom = bounds.bottom - viewport.top;
      const left = bounds.left - viewport.left;
      const right = bounds.right - viewport.left;
      const shiftY =
        top < inset
          ? top - inset
          : bottom > wrap.clientHeight - inset
            ? bottom - wrap.clientHeight + inset
            : 0;
      const shiftX =
        left < inset
          ? left - inset
          : right > wrap.clientWidth - inset
            ? right - wrap.clientWidth + inset
            : 0;
      if (shiftX || shiftY)
        wrap.scrollBy({ left: shiftX, top: shiftY, behavior: "smooth" });
    }

    function updateZoom() {
      const wrap = $("#drawingWrap");
      $("#zoomLabel").textContent = `${Math.round(state.zoom * 100)}%`;
      $("#zoomOut").disabled = state.zoom <= config.zoomMin;
      $("#zoomIn").disabled = state.zoom >= config.zoomMax;

      // Fit once, then scale the actual drawing instead of an oversized flex box.
      // This keeps every edge reachable when either direction needs scrolling.
      const padding = getComputedStyle(wrap);
      const width =
        wrap.clientWidth -
        parseFloat(padding.paddingLeft) -
        parseFloat(padding.paddingRight);
      const height =
        wrap.clientHeight -
        parseFloat(padding.paddingTop) -
        parseFloat(padding.paddingBottom);
      if (width <= 0 || height <= 0) return;
      const scale = Math.min(
        width / context.drawingSize.width,
        height / context.drawingSize.height,
      );
      $("#cabinetDrawing").style.width =
        `${context.drawingSize.width * scale * state.zoom}px`;
      $("#cabinetDrawing").style.height =
        `${context.drawingSize.height * scale * state.zoom}px`;
    }
    return { revealPart, updateZoom };
  };
})();
