(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const icon = (name) =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const validUrl = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  const hasLink = (p) => !!(validUrl(p.docsUrl) || validUrl(p.sellerUrl));
  const partSelector = (id) => `[data-part="${CSS.escape(String(id))}"]`;
  function readDrawingSize(svg, fallback) {
    if (typeof svg !== "string" || !/<svg\b/i.test(svg)) {
      throw new TypeError("A drawing must be an SVG string.");
    }
    const match = /<svg\b[^>]*\bviewBox\s*=\s*["']([^"']+)["']/i.exec(svg);
    if (!match) return { ...fallback };
    const values = match[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      values.length !== 4 ||
      !values.every(Number.isFinite) ||
      values[2] <= 0 ||
      values[3] <= 0
    ) {
      throw new Error(
        "Drawing viewBox must contain four numbers with positive dimensions.",
      );
    }
    return { width: values[2], height: values[3] };
  }
  window.PanelAtlas.utils = {
    $,
    $$,
    icon,
    escape,
    validUrl,
    hasLink,
    partSelector,
    readDrawingSize,
  };
})();
