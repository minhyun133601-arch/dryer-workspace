(() => {
  "use strict";
  window.PanelAtlas.views.createFeedbackView = function (context) {
    const { $ } = context.utils;
    let toastTimer;
    function setToast(message) {
      clearTimeout(toastTimer);
      $("#toast").textContent = message;
      $("#toast").classList.add("visible");
      toastTimer = setTimeout(
        () => $("#toast").classList.remove("visible"),
        3200,
      );
    }
    function destroy() {
      clearTimeout(toastTimer);
      $("#toast").classList.remove("visible");
    }
    return { setToast, destroy };
  };
})();
