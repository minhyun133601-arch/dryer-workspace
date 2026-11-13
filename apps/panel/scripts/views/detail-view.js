(() => {
  "use strict";
  window.PanelAtlas.views.createDetailView = function (context) {
    const { $, escape } = context.utils;
    const template = context.views.detailTemplate;
    function renderDetail() {
      const p = context.selected();
      if (!p) {
        $("#detailContent").innerHTML =
          '<div class="empty-list">등록된 부품이 없습니다.</div>';
        return;
      }
      const activeTab = $("#detailContent").contains(document.activeElement)
        ? document.activeElement.dataset.tab
        : null;
      const { resourceCard, additionalResourceCards } = context.views.resources;
      const resources = `<div class="section-label">연결 자료 <span>스펙 · 구매 정보</span></div><div class="resource-grid">${resourceCard("docs", p)}${resourceCard("seller", p)}${additionalResourceCards(p)}</div>`;
      const info =
        context.state.detailTab === "info"
          ? template.specifications(p)
          : '<p class="summary">등록한 스펙·매뉴얼과 판매처 페이지를 새 탭에서 열 수 있습니다.</p>';
      const notes = p.notes
        ? `<div class="section-label">관리 메모</div><div class="part-note">${escape(p.notes)}</div>`
        : "";
      $("#detailContent").innerHTML = [
        template.detailHeader(p),
        '<div class="detail-scroll">',
        template.partPhoto(p),
        template.detailTabs(p, context.state.detailTab),
        '<div role="tabpanel">',
        info,
        resources,
        notes,
        "</div></div>",
        template.detailFooter(),
      ].join("");
      context.controllers?.popout?.syncSelected();
      if (activeTab)
        $(`#detailContent [data-tab="${CSS.escape(activeTab)}"]`)?.focus({
          preventScroll: true,
        });
    }
    return { renderDetail };
  };
})();
