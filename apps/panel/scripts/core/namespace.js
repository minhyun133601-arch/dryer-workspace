(() => {
  "use strict";
  const atlas = (window.PanelAtlas = window.PanelAtlas || {});
  for (const name of [
    "data",
    "services",
    "state",
    "views",
    "controllers",
    "events",
  ]) {
    atlas[name] = atlas[name] || {};
  }
  atlas.data.partGroups = atlas.data.partGroups || {};
})();
