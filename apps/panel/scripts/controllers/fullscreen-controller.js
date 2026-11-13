(() => {
  "use strict";
  window.PanelAtlas.controllers.createFullscreenController = function (
    context,
  ) {
    const { $ } = context.utils;
    const { state } = context;
    const card = $("#canvasCard");
    let active = false;
    let nativeSession = false;
    let snapshot = null;
    let revision = 0;
    let restoreFrame;

    const isActive = () => active;
    function updateLayout() {
      context.controllers.viewport.updateZoom();
      context.controllers.photo.updateReferenceLayout();
    }
    function updateButton() {
      const title = active ? "전체 화면 닫기 (Esc)" : "제어반 전체 화면";
      $("#toggleFullscreen").setAttribute("aria-pressed", String(active));
      $("#toggleFullscreen").setAttribute("aria-label", title);
      $("#toggleFullscreen").title = title;
      $("#fullscreenLabel").textContent = active
        ? "전체 화면 닫기"
        : "전체 화면";
      $("#fullscreenIcon").setAttribute(
        "href",
        active ? "#i-close" : "#i-expand",
      );
      card.classList.toggle("panel-fullscreen", active);
      document.body.classList.toggle("canvas-fullscreen", active);
    }
    function finishExit(restoreFocus = true) {
      if (!active) return;
      active = false;
      nativeSession = false;
      revision++;
      const previous = snapshot;
      snapshot = null;
      state.zoom = previous.zoom;
      updateButton();
      updateLayout();
      cancelAnimationFrame(restoreFrame);
      if (restoreFocus) {
        restoreFrame = requestAnimationFrame(() => {
          updateLayout();
          $("#drawingWrap").scrollTo({
            top: previous.top,
            left: previous.left,
            behavior: "instant",
          });
          $("#toggleFullscreen").focus({ preventScroll: true });
        });
      }
    }
    async function exitFullscreen() {
      if (document.fullscreenElement === card) {
        try {
          await document.exitFullscreen();
        } catch {}
      }
      finishExit();
    }
    async function toggleFullscreen() {
      if (active) return exitFullscreen();
      cancelAnimationFrame(restoreFrame);
      const wrap = $("#drawingWrap");
      snapshot = {
        zoom: state.zoom,
        top: wrap.scrollTop,
        left: wrap.scrollLeft,
      };
      const currentRevision = ++revision;
      active = true;
      document.body.classList.remove("detail-open", "inventory-open");
      state.zoom = 1;
      updateButton();
      updateLayout();
      wrap.scrollTo({ top: 0, left: 0, behavior: "instant" });
      if (!card.requestFullscreen) return;
      try {
        await card.requestFullscreen();
        if (!active || revision !== currentRevision) {
          if (document.fullscreenElement === card)
            await document.exitFullscreen();
          return;
        }
        nativeSession = document.fullscreenElement === card;
        updateLayout();
      } catch {
        // The viewport-filling layout remains available when native fullscreen is unavailable.
      }
    }
    function handleFullscreenChange() {
      if (document.fullscreenElement === card) {
        nativeSession = true;
        updateLayout();
      } else if (nativeSession) {
        finishExit();
      }
    }
    function destroy() {
      cancelAnimationFrame(restoreFrame);
      finishExit(false);
      if (document.fullscreenElement === card)
        document.exitFullscreen().catch(() => {});
    }
    return {
      isActive,
      toggleFullscreen,
      exitFullscreen,
      handleFullscreenChange,
      destroy,
    };
  };
})();
