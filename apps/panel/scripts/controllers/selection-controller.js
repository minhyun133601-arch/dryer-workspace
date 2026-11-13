(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.controllers.createSelectionController = function (context) {
    const { state, store, matches } = context;
    const { $, partSelector } = context.utils;
    const renderList = () => context.views.list.renderList();
    const renderDetail = () => context.views.detail.renderDetail();

    function selectPart(id, open = true) {
      const part = store.find(id);
      if (!part) return;
      state.selectedId = id;
      state.detailTab = "info";
      if (!matches(part)) {
        state.filter = "all";
        state.query = "";
        $("#partSearch").value = "";
      }
      renderList();
      renderDetail();
      document.body.classList.remove("inventory-open");
      const fullscreen = context.controllers.fullscreen.isActive();
      if (open && !fullscreen) document.body.classList.add("detail-open");
      const row = $(`#partList ${partSelector(id)}`);
      if (row && !fullscreen)
        row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      if (state.mode === "diagram") context.controllers.viewport.revealPart(id);
      if (open) context.controllers.popout.openSelected({ automatic: true });
    }
    return { selectPart };
  };
})();
