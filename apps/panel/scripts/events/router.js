(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.events.createRouter = function (context) {
    const { state } = context;
    const selectPart = (id, open = true) =>
      context.controllers.selection.selectPart(id, open);
    const openEditor = (focus = "name") =>
      context.controllers.editor.openEditor(focus);
    const renderDetail = () => context.views.detail.renderDetail();
    function handleDocumentClick(e) {
      const target = e.target.closest("[data-part]");
      if (target) {
        selectPart(target.dataset.part);
        return;
      }
      const edit = e.target.closest("[data-edit]");
      if (edit) {
        openEditor(edit.dataset.edit);
        return;
      }
      const close = e.target.closest("[data-close]");
      if (close) {
        document.getElementById(close.dataset.close).close();
        return;
      }
      const tab = e.target.closest("[data-tab]");
      if (tab) {
        state.detailTab = tab.dataset.tab;
        renderDetail();
        return;
      }
      const action = e.target.closest("[data-action]")?.dataset.action;
      const handler = context.actions.get(action);
      if (handler) handler(e);
    }
    return { handleDocumentClick };
  };
})();
