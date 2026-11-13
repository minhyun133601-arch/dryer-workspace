/* Assemble the cabinet from ordered, independently replaceable section builders. */
(() => {
  const drawing = window.PanelAtlas.drawing;

  drawing.sectionOrder = [
    "upper",
    "plc",
    "protection",
    "power-control",
    "relays",
    "terminals",
    "transformers",
  ];

  // A custom order lets an automation feature add or replace sections without DOM access.
  function buildCabinet(sectionOrder = drawing.sectionOrder) {
    if (!Array.isArray(sectionOrder)) {
      throw new TypeError(
        "The cabinet section order must be an array of section IDs.",
      );
    }
    const sections = sectionOrder
      .map((id) => {
        const buildSection = Object.prototype.hasOwnProperty.call(
          drawing.sections,
          id,
        )
          ? drawing.sections[id]
          : null;
        if (typeof buildSection !== "function") {
          throw new Error(`Cabinet section builder is not registered: ${id}`);
        }
        const fragment = buildSection();
        if (typeof fragment !== "string") {
          throw new TypeError(
            `Cabinet section builder must return an SVG string: ${id}`,
          );
        }
        return fragment;
      })
      .join("");

    return (
      drawing.buildDefinitions() +
      drawing.buildLabels() +
      drawing.buildFrame() +
      drawing.buildWiring() +
      sections +
      "</svg>"
    );
  }

  drawing.buildCabinet = buildCabinet;
  window.cabinetSVG = buildCabinet();
})();
