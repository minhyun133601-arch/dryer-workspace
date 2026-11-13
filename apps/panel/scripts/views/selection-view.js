(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.views.createSelectionView = function (context) {
    const { state, store, selected, matches } = context;
    const { $, $$, hasLink } = context.utils;

    function renderSelection() {
      $$("#cabinetDrawing .part-hit").forEach((el) => {
        const p = store.find(el.dataset.part);
        if (!p) return;
        el.classList.toggle("is-selected", p.id === state.selectedId);
        el.classList.toggle("is-linked", hasLink(p));
        el.classList.toggle("is-muted", !matches(p));
        el.setAttribute("aria-pressed", p.id === state.selectedId);
        el.setAttribute("aria-label", p.name + " 정보 보기");
      });
      $$("#referenceWrap button[data-part]").forEach((button) => {
        const active = button.dataset.part === state.selectedId;
        button.classList.toggle("is-selected", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const part = selected();
      $("#canvasHint").textContent = part
        ? `${part.name} 선택됨 · 다른 부품도 눌러보세요`
        : "등록된 부품이 없습니다.";
    }
    return { renderSelection };
  };
})();
