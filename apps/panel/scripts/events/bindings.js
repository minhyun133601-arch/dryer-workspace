(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.events.createBindings = function (context) {
    const { state, config } = context;
    const { $, $$ } = context.utils;
    const handleDocumentClick = (e) => context.router.handleDocumentClick(e);
    const handleEditorSubmit = (e) =>
      context.controllers.editor.handleEditorSubmit(e);
    const selectPart = (id, open = true) =>
      context.controllers.selection.selectPart(id, open);
    const openEditor = (focus = "name") =>
      context.controllers.editor.openEditor(focus);
    const renderList = () => context.views.list.renderList();
    const setMode = (next) => context.controllers.mode.setMode(next);
    const updateZoom = () => context.controllers.viewport.updateZoom();

    function bindEvents() {
      const signal = context.abort.signal;
      const on = (element, type, listener) =>
        element.addEventListener(type, listener, { signal });
      on(document, "click", handleDocumentClick);
      on(window, "message", context.controllers.popout.handleMessage);
      on($("#editForm"), "submit", handleEditorSubmit);
      on($("#cabinetDrawing"), "keydown", (e) => {
        if (
          (e.key === "Enter" || e.key === " ") &&
          e.target.closest("[data-part]")
        ) {
          e.preventDefault();
          selectPart(e.target.closest("[data-part]").dataset.part);
        }
      });
      on($("#partSearch"), "input", (e) => {
        state.query = e.target.value.trim().toLowerCase();
        renderList();
      });
      on($(".filters"), "click", (e) => {
        if (e.target.dataset.filter) {
          state.filter = e.target.dataset.filter;
          renderList();
        }
      });
      on($("#topEdit"), "click", () => openEditor("docsUrl"));
      on($("#mobileList"), "click", () => {
        document.body.classList.remove("detail-open");
        document.body.classList.add("inventory-open");
      });
      on($("#closeInventory"), "click", () =>
        document.body.classList.remove("inventory-open"),
      );
      on($("#mobileBackdrop"), "click", () =>
        document.body.classList.remove("detail-open", "inventory-open"),
      );
      on(document, "keydown", (e) => {
        if (e.key !== "Escape" || $("dialog[open]")) return;
        if (context.controllers.fullscreen.isActive()) {
          e.preventDefault();
          context.controllers.fullscreen.exitFullscreen();
          return;
        }
        document.body.classList.remove("detail-open", "inventory-open");
      });
      on(
        document,
        "fullscreenchange",
        context.controllers.fullscreen.handleFullscreenChange,
      );
      on($("#diagramMode"), "click", () => setMode("diagram"));
      on($("#photoMode"), "click", () => setMode("photo"));
      on($("#zoomIn"), "click", () => {
        state.zoom = Math.min(config.zoomMax, state.zoom + config.zoomStep);
        updateZoom();
      });
      on($("#zoomOut"), "click", () => {
        state.zoom = Math.max(config.zoomMin, state.zoom - config.zoomStep);
        updateZoom();
      });
      on($("#fitView"), "click", () => {
        state.zoom = 1;
        updateZoom();
        $("#drawingWrap").scrollTo({ top: 0, left: 0, behavior: "smooth" });
      });
      on(
        $(".reference-photo img"),
        "load",
        context.controllers.photo.updateReferenceLayout,
      );
      $$("dialog").forEach((dialog) =>
        on(dialog, "click", (e) => {
          if (e.target === dialog) {
            const r = dialog.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              dialog.close();
          }
        }),
      );
    }
    return { bindEvents };
  };
})();
