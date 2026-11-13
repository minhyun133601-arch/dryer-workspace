(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.controllers.createEditorController = function (context) {
    const { state, store, selected } = context;
    const { $, validUrl } = context.utils;
    const { editableKeys } = context.config;
    const renderList = () => context.views.list.renderList();
    const renderDetail = () => context.views.detail.renderDetail();
    const setToast = (message) => context.views.feedback.setToast(message);

    function openEditor(focus = "name") {
      state.editingId = state.selectedId;
      const p = selected();
      if (!p) return;
      editableKeys.forEach((key) => {
        $("#editForm").elements[key].value = p[key] || "";
      });
      $("#editSubtitle").textContent = `${p.name} · ${p.tag}`;
      $("#formError").hidden = true;
      $("#editDialog").showModal();
      requestAnimationFrame(() => {
        $("#editForm").elements[focus]?.focus();
      });
    }

    function handleEditorSubmit(e) {
      e.preventDefault();
      const form = e.currentTarget;
      const p = store.find(state.editingId);
      if (!p) return;
      const updated = {};
      editableKeys.forEach(
        (key) => (updated[key] = form.elements[key].value.trim()),
      );
      if (!updated.name) {
        form.elements.name.focus();
        return;
      }
      for (const key of ["docsUrl", "sellerUrl"]) {
        if (updated[key] && !validUrl(updated[key])) {
          $("#formError").textContent =
            "http:// 또는 https://로 시작하는 올바른 주소를 입력해 주세요.";
          $("#formError").hidden = false;
          form.elements[key].focus();
          return;
        }
        if (updated[key]) updated[key] = validUrl(updated[key]);
      }
      try {
        store.savePart(p.id, updated);
      } catch {
        $("#formError").textContent =
          "이 브라우저에서 저장할 수 없습니다. 저장 공간 또는 브라우저 설정을 확인해 주세요.";
        $("#formError").hidden = false;
        return;
      }
      $("#editDialog").close();
      renderList();
      renderDetail();
      setToast(`${p.name} 정보를 이 브라우저에 저장했습니다.`);
    }
    return { openEditor, handleEditorSubmit };
  };
})();
