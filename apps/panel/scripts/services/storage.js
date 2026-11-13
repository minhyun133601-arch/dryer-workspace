(() => {
  "use strict";
  window.PanelAtlas.services.createStorage = function (
    key,
    getStorage = () => window.localStorage,
  ) {
    function loadSavedData() {
      try {
        const value = JSON.parse(getStorage().getItem(key) || "{}");
        if (value && typeof value === "object" && !Array.isArray(value))
          return value;
      } catch {}
      return {};
    }
    function saveSavedData(value) {
      getStorage().setItem(key, JSON.stringify(value));
    }
    return { loadSavedData, saveSavedData };
  };
})();
