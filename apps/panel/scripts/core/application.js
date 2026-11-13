(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.createApplication = function (options = {}) {
    const config = { ...atlas.config, ...options.config };
    const storage =
      options.storage || atlas.services.createStorage(config.storageKey);
    const store = atlas.state.createPartsStore(
      options.parts || window.PARTS,
      storage,
      config.editableKeys,
    );
    const state = atlas.state.createUIState(store.parts, config);
    const context = {
      config,
      store,
      state,
      utils: atlas.utils,
      referencePhoto: options.referencePhoto || atlas.data.referencePhoto,
      views: {},
      controllers: {},
      actions: new Map(),
    };
    const { $, $$, readDrawingSize } = atlas.utils;
    let initialized = false;
    let svg = options.svg ?? window.cabinetSVG;
    const observers = [];
    context.drawingSize = readDrawingSize(svg, atlas.drawing.size);
    context.selected = () => store.find(state.selectedId);
    context.matches = (p) =>
      (state.filter === "all" || p.category === state.filter) &&
      (!state.query ||
        [p.name, p.brand, p.model, p.tag, p.location, p.rating]
          .join(" ")
          .toLowerCase()
          .includes(state.query));
    for (const [key, factory] of Object.entries({
      feedback: "createFeedbackView",
      resources: "createResourceView",
      detailTemplate: "createDetailTemplate",
      selection: "createSelectionView",
      list: "createListView",
      detail: "createDetailView",
    }))
      context.views[key] = atlas.views[factory](context);
    for (const [key, factory] of Object.entries({
      viewport: "createViewportController",
      photo: "createPhotoController",
      mode: "createModeController",
      selection: "createSelectionController",
      editor: "createEditorController",
      fullscreen: "createFullscreenController",
      popout: "createPopoutController",
    }))
      context.controllers[key] = atlas.controllers[factory](context);
    context.router = atlas.events.createRouter(context);
    context.bindings = atlas.events.createBindings(context);
    context.actions.set("close-detail", () =>
      document.body.classList.remove("detail-open"),
    );
    context.actions.set("open-photo", () =>
      context.controllers.photo.openPhoto(),
    );
    context.actions.set("toggle-fullscreen", () =>
      context.controllers.fullscreen.toggleFullscreen(),
    );
    context.actions.set("open-part-window", () =>
      context.controllers.popout.openSelected(),
    );
    context.actions.set("toggle-auto-popout", (event) =>
      context.controllers.popout.setAutomaticEnabled(event.target.checked),
    );

    function mountDrawing() {
      $("#cabinetDrawing").innerHTML = svg;
      $$(".section-label", $("#cabinetDrawing")).forEach((el) =>
        el.classList.replace("section-label", "cabinet-section-label"),
      );
    }
    function observe(element, callback) {
      const observer = new ResizeObserver(callback);
      observer.observe(element);
      observers.push(observer);
    }
    function initialize() {
      if (initialized) return application;
      context.abort = new AbortController();
      try {
        mountDrawing();
        $("#totalCount").textContent = store.parts.length;
        $("#topEdit").disabled = !context.selected();
        context.bindings.bindEvents();
        context.controllers.photo.mountReferencePhoto();
        context.views.list.renderList();
        context.views.detail.renderDetail();
        context.controllers.mode.setMode(state.mode);
        observe($("#drawingWrap"), context.controllers.viewport.updateZoom);
        observe(
          $("#referenceWrap"),
          context.controllers.photo.updateReferenceLayout,
        );
        initialized = true;
      } catch (error) {
        destroy();
        throw error;
      }
      return application;
    }
    function destroy() {
      context.controllers.fullscreen.destroy();
      context.abort?.abort();
      observers.splice(0).forEach((observer) => observer.disconnect());
      context.views.feedback.destroy();
      $$("dialog[open]").forEach((dialog) => dialog.close());
      document.body.classList.remove("detail-open", "inventory-open");
      initialized = false;
      return application;
    }
    function replaceDrawing(nextSVG) {
      const size = readDrawingSize(nextSVG, atlas.drawing.size);
      svg = nextSVG;
      context.drawingSize = size;
      window.cabinetSVG = svg;
      if (initialized) {
        mountDrawing();
        context.views.selection.renderSelection();
        context.controllers.viewport.updateZoom();
      }
      return application;
    }
    function registerAction(name, handler) {
      if (typeof name !== "string" || !name || typeof handler !== "function")
        throw new TypeError("An action requires a name and a function.");
      context.actions.set(name, handler);
      return () => {
        if (context.actions.get(name) === handler) context.actions.delete(name);
      };
    }
    const application = {
      state,
      store,
      views: context.views,
      controllers: context.controllers,
      initialize,
      destroy,
      replaceDrawing,
      registerAction,
    };
    return application;
  };
})();
