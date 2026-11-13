// Preserve the original catalog order and legacy global.
window.PARTS = ["plc", "upper", "middle", "lower"].flatMap(
  (group) => window.PanelAtlas.data.partGroups[group],
);
window.PARTS.forEach((p) => {
  p.photo = window.REFERENCE_IMAGES[p.photo] ||
    (p.photo?.startsWith("assets/") ? `../../${p.photo}` : p.photo) || "";
});
