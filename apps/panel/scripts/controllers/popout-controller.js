(() => {
  "use strict";
  window.PanelAtlas.controllers.createPopoutController = function (context) {
    const preferenceKey = "panel-atlas-popout-auto-v1";
    // Chromium can expose location.origin as "file://" while message origins are "null".
    const origin = new URL(window.location.href).protocol === "file:"
      ? "null"
      : window.location.origin;
    const targetOrigin = origin === "null" ? "*" : origin;
    let detailWindow = null;
    let ready = false;
    let pendingForce = false;
    let automaticBlocked = false;
    let automaticEnabled = true;
    try {
      automaticEnabled = window.localStorage.getItem(preferenceKey) !== "false";
    } catch {}

    const isAutomaticEnabled = () => automaticEnabled;
    const isOpen = () => !!detailWindow && !detailWindow.closed;
    function syncSelected(force = false) {
      const part = context.selected();
      if (!part || !isOpen() || !ready) return;
      try {
        detailWindow.postMessage(
          { type: "panel-atlas:part", part, force },
          targetOrigin,
        );
      } catch {
        // The inline information remains available if a separate window navigates away.
      }
    }
    function openSelected({ automatic = false } = {}) {
      if (!context.selected()) return false;
      if (
        automatic &&
        (!automaticEnabled || automaticBlocked ||
          !window.matchMedia("(min-width: 721px)").matches)
      ) return false;
      if (isOpen()) {
        syncSelected(!automatic);
        if (!automatic) detailWindow.focus();
        return true;
      }
      const url = new URL("part-details.html", window.location.href);
      url.searchParams.set("part", context.selected().id);
      const width = Math.max(600, Math.min(1080, (window.screen.availWidth || 1440) - 80));
      const height = Math.max(600, Math.min(940, (window.screen.availHeight || 1000) - 80));
      ready = false;
      pendingForce = !automatic;
      try {
        detailWindow = window.open(
          url.href,
          "panel-atlas-part-details",
          `popup=yes,width=${width},height=${height},resizable=yes,scrollbars=yes`,
        );
      } catch {
        detailWindow = null;
      }
      if (!isOpen()) {
        automaticBlocked = true;
        context.views.feedback.setToast(
          "새 창이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 ‘새 창으로 보기’를 눌러주세요.",
        );
        return false;
      }
      automaticBlocked = false;
      return true;
    }
    function handleMessage(event) {
      if (!isOpen() || event.source !== detailWindow || event.origin !== origin) return;
      if (event.data?.type === "panel-atlas:ready") {
        ready = true;
        syncSelected(pendingForce);
        pendingForce = false;
      } else if (event.data?.type === "panel-atlas:follow" && event.data.follow === true) {
        syncSelected();
      }
    }
    function setAutomaticEnabled(enabled) {
      automaticEnabled = !!enabled;
      if (automaticEnabled) automaticBlocked = false;
      try {
        window.localStorage.setItem(preferenceKey, String(automaticEnabled));
      } catch {}
    }
    return { openSelected, syncSelected, handleMessage, setAutomaticEnabled, isAutomaticEnabled, isOpen };
  };
})();
