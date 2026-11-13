(() => {
  "use strict";
  window.PanelAtlas.state.createPartsStore = function (
    defaults,
    storage,
    editableKeys,
  ) {
    let saved = storage.loadSavedData();
    const byId = new Map();
    const parts = defaults.map((part) => {
      if (
        !part ||
        typeof part.id !== "string" ||
        !part.id ||
        byId.has(part.id)
      ) {
        throw new Error(
          "Each catalog part must have a unique, nonempty string id.",
        );
      }
      const extra = saved[part.id];
      const overrides = {};
      if (extra && typeof extra === "object") {
        editableKeys.forEach((key) => {
          if (typeof extra[key] === "string") overrides[key] = extra[key];
        });
      }
      const current = {
        docsUrl: "",
        sellerName: "",
        sellerUrl: "",
        notes: "",
        ...part,
        ...overrides,
      };
      byId.set(part.id, current);
      return current;
    });
    function find(id) {
      return byId.get(id);
    }
    function savePart(id, updated) {
      const part = find(id);
      if (!part) return null;
      const changes = {};
      editableKeys.forEach((key) => {
        changes[key] = typeof part[key] === "string" ? part[key] : "";
        if (typeof updated[key] === "string") changes[key] = updated[key];
      });
      const nextSaved = { ...saved, [id]: changes };
      // Commit to the model only after persistent storage succeeds.
      storage.saveSavedData(nextSaved);
      saved = nextSaved;
      Object.assign(part, changes);
      return part;
    }
    return { parts, find, savePart };
  };
})();
