(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  atlas.application?.destroy();
  atlas.application = atlas.createApplication();
  atlas.application.initialize();
  if (window.parent !== window && window.location.origin !== "null") {
    window.parent.postMessage(
      { type: "dryer-workspace:ready", moduleId: "panel" },
      window.location.origin,
    );
  }
})();
