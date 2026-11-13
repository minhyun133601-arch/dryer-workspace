(() => {
  "use strict";
  window.PanelAtlas.views.createDetailTemplate = function (context) {
    const { icon, escape, hasLink } = context.utils;
    const { categories } = context.config;
    function detailHeader(p) {
      return [
        '<div class="detail-top"><div class="detail-caption"><span>선택한 부품</span><div class="detail-heading-tools">',
        `<span class="part-tag">${escape(p.tag)}</span>`,
        `<button class="icon-button detail-close" data-action="close-detail" aria-label="부품 정보 닫기">${icon("close")}</button>`,
        '</div></div><div class="detail-name-row">',
        `<div class="detail-icon">${icon(categories[p.category].icon)}</div>`,
        `<div class="detail-name"><h2>${escape(p.name)}</h2><p>${escape(p.brand || "제조사 미입력")}</p></div></div>`,
        `<div class="detail-status ${hasLink(p) ? "linked" : ""}"><i></i>${hasLink(p) ? "자료 링크 연결됨" : "자료 링크 미등록"}</div>`,
        `<button type="button" class="button primary detail-popout" data-action="open-part-window">${icon("external")}새 창으로 보기</button><p class="detail-popout-hint">창 제목줄을 끌어 다른 모니터로 옮기세요.</p></div>`,
      ].join("");
    }
    function partPhoto(p) {
      if (!p.photo) return "";
      const title =
        p.category === "plc"
          ? "PLC 랙 실물 참고 사진"
          : "해당 구역 실물 참고 사진";
      return [
        `<button class="part-photo" type="button" data-action="open-photo" aria-label="${title} 크게 보기">`,
        `<img src="${escape(p.photo)}" alt="${title}">`,
        `<span class="photo-label">${icon("photo")}실물 참고 사진</span>`,
        `<span class="photo-enlarge">${icon("fit")}</span></button>`,
      ].join("");
    }
    function detailTabs(p, tab) {
      return [
        '<div class="info-tabs" role="tablist" aria-label="부품 상세 탭">',
        `<button type="button" role="tab" class="${tab === "info" ? "active" : ""}" aria-selected="${tab === "info"}" data-tab="info">부품 정보</button>`,
        `<button type="button" role="tab" class="${tab === "links" ? "active" : ""}" aria-selected="${tab === "links"}" data-tab="links">연결 자료 <span>${context.views.resources.resourceCount(p)}</span></button></div>`,
      ].join("");
    }
    function specifications(p) {
      const specs = [
        ["제조사", p.brand],
        ["모델·제품군", p.model],
        ["주요 사양", p.rating],
        ["설치 위치", p.location],
      ];
      return (
        '<dl class="spec-list">' +
        specs
          .map(
            ([key, value]) =>
              `<div class="spec-row"><dt>${key}</dt><dd class="${value ? "" : "empty"}">${escape(value || "정보를 입력해 주세요")}</dd></div>`,
          )
          .join("") +
        `</dl><p class="summary">${escape(p.summary)}</p>`
      );
    }
    function detailFooter() {
      const automatic = context.controllers?.popout?.isAutomaticEnabled() ?? true;
      return `<div class="detail-bottom"><label class="popout-preference"><input type="checkbox" data-action="toggle-auto-popout" ${automatic ? "checked" : ""}>PC에서 부품 클릭 시 새 창 열기</label><button type="button" class="button" data-edit="name">${icon("pencil")}정보·링크 편집</button></div>`;
    }
    return {
      detailHeader,
      partPhoto,
      detailTabs,
      specifications,
      detailFooter,
    };
  };
})();
