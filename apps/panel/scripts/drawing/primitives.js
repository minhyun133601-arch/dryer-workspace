/* Shared SVG helpers. Keep their original names and argument defaults. */
(() => {
  const atlas = window.PanelAtlas || (window.PanelAtlas = {});
  const drawing = atlas.drawing || (atlas.drawing = {});
  const screw = (x, y, r = 2.3) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#d3d6d2" stroke="#67716f" stroke-width=".65"/><path d="M${x - r * 0.65} ${y + r * 0.28}l${r * 1.3} ${-r * 0.56}" stroke="#5b6663" stroke-width=".7"/>`;
  const wire = (x1, y1, x2, y2, color, bend = 0, width = 1.7) =>
    `<path d="M${x1} ${y1}C${x1 + bend} ${(y1 + y2) / 2} ${x2 - bend} ${(y1 + y2) / 2} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const cableColors = ["#963f33", "#245c94", "#ab4c3c", "#243d5b", "#c7b06b"];
  const wireBank = (x, y1, y2, count, gap, step = 0) =>
    Array.from({ length: count }, (_, i) =>
      wire(
        x + i * gap,
        y1,
        x + i * gap + step,
        y2,
        cableColors[i % cableColors.length],
        i % 2 ? 2 : -2,
        1.45,
      ),
    ).join("");
  const tag = (x, y, label, width = 34) =>
    `<rect x="${x}" y="${y}" width="${width}" height="8" rx=".8" fill="#f7f8f5" stroke="#a7aeaa" stroke-width=".5"/><text x="${x + width / 2}" y="${y + 5.7}" text-anchor="middle" font-size="4.9" fill="#646e68" font-family="monospace">${label}</text>`;
  const rail = (x, y, w) =>
    `<rect x="${x}" y="${y}" width="${w}" height="14" rx="1" fill="url(#railMetal)" stroke="#848e87" stroke-width=".8"/><path d="M${x + 1} ${y + 3}h${w - 2}M${x + 1} ${y + 11}h${w - 2}" stroke="#e9ece5" stroke-width="1"/>${Array.from({ length: Math.floor(w / 21) }, (_, i) => `<rect x="${x + 7 + i * 21}" y="${y + 5}" width="10" height="4" rx="2" fill="#bf7744"/>`).join("")}`;
  const duct = (y, labels = []) =>
    `<g>${Array.from({ length: 24 }, (_, i) => `<path d="M${185 + i * 17.3} ${y - 5}v7" stroke="#68716d" stroke-width="5.8"/>`).join("")}<rect x="179" y="${y}" width="432" height="24" rx="1.5" fill="url(#ductMetal)" stroke="#7d8984" stroke-width=".7"/><path d="M181 ${y + 3}h428M181 ${y + 20}h428" stroke="#d8ddd7" stroke-width="1"/>${labels.map((v, i) => tag(205 + i * (350 / Math.max(labels.length - 1, 1)), y + 9, v, 32)).join("")}</g>`;
  const part = (id, label, x, y, w, h, art) =>
    `<g class="part-hit" data-part="${id}" tabindex="0" role="button" aria-label="${label}" style="cursor:pointer"><title>${label}</title>${art}<rect class="hit-outline" x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="4" fill="transparent" stroke="transparent" stroke-width="2.4" vector-effect="non-scaling-stroke"/></g>`;
  const label = (index, title, y) =>
    `<g class="section-label"><text x="16" y="${y - 9}" font-size="10" font-weight="600" letter-spacing="1.4" fill="#9aa5a0" font-family="monospace">${index}</text><text x="16" y="${y + 11}" font-size="15" font-weight="550" fill="#66756c" font-family="Pretendard, 'Noto Sans KR', sans-serif">${title}</text><path d="M112 ${y + 7}h25" stroke="#c6cfc7" stroke-width="1"/><circle cx="137" cy="${y + 7}" r="2" fill="#b6c0b7"/></g>`;

  drawing.size = { width: 740, height: 1080 };
  drawing.sections = drawing.sections || Object.create(null);
  drawing.primitives = {
    screw,
    wire,
    wireBank,
    tag,
    rail,
    duct,
    part,
    label,
    cableColors,
  };
})();
