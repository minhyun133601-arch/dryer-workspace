(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.views.createResourceView = function (context) {
    const { icon, escape, validUrl } = context.utils;
    function linkedCard(type, title, url) {
      const symbol = type === "docs" ? "doc" : "store";
      return `<a class="resource-card" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${icon(symbol)}<span class="resource-copy"><strong>${escape(title)}</strong><small>${escape(new URL(url).hostname)}</small></span><svg class="icon resource-end"><use href="#i-external"/></svg></a>`;
    }
    function resourceCard(type, p) {
      const docs = type === "docs";
      const url = validUrl(docs ? p.docsUrl : p.sellerUrl);
      const title = docs ? p.docsTitle || "스펙·매뉴얼" : p.sellerName || "판매처";
      const symbol = docs ? "doc" : "store";
      if (url) return linkedCard(type, title, url);
      return `<button type="button" class="resource-card empty-resource" data-edit="${docs ? "docsUrl" : "sellerUrl"}">${icon(symbol)}<span class="resource-copy"><strong>${escape(docs ? title : "판매처")}</strong><small>주소를 연결해 주세요</small></span><svg class="icon resource-end"><use href="#i-plus"/></svg></button>`;
    }
    function relatedResources(p) {
      if (!Array.isArray(p.relatedResources)) return [];
      return p.relatedResources.flatMap((resource) => {
        if (!resource || !["docs", "seller"].includes(resource.type)) return [];
        const url = validUrl(resource.url);
        return url ? [{ ...resource, url }] : [];
      });
    }
    function additionalResourceCards(p) {
      return relatedResources(p)
        .map((resource) =>
          linkedCard(
            resource.type,
            resource.title || (resource.type === "docs" ? "스펙·매뉴얼" : "판매처"),
            resource.url,
          ),
        )
        .join("");
    }
    function resourceCount(p) {
      return [p.docsUrl, p.sellerUrl].filter(validUrl).length + relatedResources(p).length;
    }
    return { resourceCard, additionalResourceCards, resourceCount };
  };
})();
