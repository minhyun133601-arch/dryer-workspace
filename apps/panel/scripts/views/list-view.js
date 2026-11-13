(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.views.createListView = function (context) {
    const { state, store, config, matches } = context;
    const { $, $$, icon, escape, hasLink, partSelector } = context.utils;
    const { categories } = config;
    const parts = store.parts;

    function renderList() {
      const focusedId = $("#partList").contains(document.activeElement)
        ? document.activeElement.closest("[data-part]")?.dataset.part
        : null;
      const filtered = parts.filter(matches);
      $("#listCount").textContent = filtered.length;
      $("#partList").innerHTML = filtered.length
        ? Object.entries(categories)
            .map(([key, category]) => {
              const items = filtered.filter((p) => p.category === key);
              if (!items.length) return "";
              return (
                `<div class="part-group-title">${category.title}<span>${String(items.length).padStart(2, "0")}</span></div>` +
                items
                  .map(
                    (p) =>
                      `<button type="button" class="part-row ${p.id === state.selectedId ? "is-selected" : ""}" data-part="${escape(p.id)}" aria-pressed="${p.id === state.selectedId}"><span class="part-mini-icon">${icon(category.icon)}</span><span class="part-row-text"><strong>${escape(p.name)}</strong><small>${escape(p.brand || "제조사 입력 대기")} · ${escape(p.tag)}</small></span>${hasLink(p) ? '<span class="row-link" title="링크 연결됨"></span>' : ""}<svg class="icon row-arrow" aria-hidden="true"><use href="#i-chevron"/></svg></button>`,
                  )
                  .join("")
              );
            })
            .join("")
        : '<div class="empty-list">검색 결과가 없습니다.<br>다른 부품명이나 제조사로<br>검색해 보세요.</div>';
      $$(".filters button").forEach((btn) => {
        const active = btn.dataset.filter === state.filter;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active);
      });
      $("#linkedCount").textContent = parts.filter(hasLink).length;
      if (focusedId)
        $(`#partList ${partSelector(focusedId)}`)?.focus({
          preventScroll: true,
        });
      context.views.selection.renderSelection();
    }
    return { renderList };
  };
})();
