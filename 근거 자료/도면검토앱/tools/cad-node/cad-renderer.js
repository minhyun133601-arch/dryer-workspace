(function createCadRenderer(Tool) {
  "use strict";

  // A model-space, XY top-view renderer shared by extraction and conversion.
  // Original entities are never changed. Unsupported geometry is reported.
  const TAU = Math.PI * 2;
  const identity = [1, 0, 0, 1, 0, 0];
  const limit = 500000;
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const point = (value) => value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y));
  const entries = (database, name) => database?.tables?.[name]?.entries || [];

  function multiply(a, b) {
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  }

  function transform(matrix, value) {
    return { x: matrix[0] * value.x + matrix[2] * value.y + matrix[4],
      y: matrix[1] * value.x + matrix[3] * value.y + matrix[5] };
  }

  function placement(x, y, angle = 0, sx = 1, sy = 1) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c * sx, s * sx, -s * sy, c * sy, x, y];
  }

  function ocs(entity) {
    const n = entity.extrusionDirection;
    if (!n || (Math.abs(finite(n.x)) < 1e-10 && Math.abs(finite(n.y)) < 1e-10 && finite(n.z, 1) > 0)) return identity;
    const length = Math.hypot(finite(n.x), finite(n.y), finite(n.z, 1));
    // Older decoded DWGs can leave the omitted default normal as (0,0,0).
    if (length < 1e-10) return identity;
    const z = { x: finite(n.x) / length, y: finite(n.y) / length, z: finite(n.z, 1) / length };
    const small = Math.abs(z.x) < 1 / 64 && Math.abs(z.y) < 1 / 64;
    let ax = small ? [z.z, 0, -z.x] : [-z.y, z.x, 0];
    const len = Math.hypot(...ax) || 1;
    ax = ax.map((v) => v / len);
    const ay = [z.y * ax[2] - z.z * ax[1], z.z * ax[0] - z.x * ax[2]];
    const elevation = finite(entity.elevation ?? entity.center?.z ?? entity.insertionPoint?.z ?? entity.startPoint?.z);
    return [ax[0], ax[1], ay[0], ay[1], z.x * elevation, z.y * elevation];
  }

  function collectEntities(database) {
    const result = [], handles = new Set(), objects = new Set();
    function add(entity, owner, blockName) {
      if (!entity || objects.has(entity) || (entity.handle && handles.has(entity.handle))) return;
      objects.add(entity);
      if (entity.handle) handles.add(entity.handle);
      result.push({ entity, owner, blockName });
      for (const attribute of entity.attribs || []) add(attribute, entity.handle || owner, blockName);
    }
    for (const entity of database.entities || []) add(entity, entity.ownerBlockRecordSoftId || null, "*Model_Space");
    for (const block of entries(database, "BLOCK_RECORD")) {
      for (const entity of block.entities || []) add(entity, block.handle, block.name);
    }
    return result;
  }

  function plainText(value) {
    return String(value || "")
      .replace(/\\U\+([a-f\d]{4,8})/gi, (_, hex) => {
        const code = parseInt(hex, 16);
        return code <= 0x10ffff ? String.fromCodePoint(code) : "\ufffd";
      })
      .replace(/%%d/gi, "°").replace(/%%p/gi, "±").replace(/%%c/gi, "⌀")
      .replace(/\\P/g, "\n").replace(/\\~/g, " ")
      .replace(/\\S([^;]*);/g, (_, fraction) => fraction.replace(/[\^#]/g, "/"))
      .replace(/\\[ACFHQTW][^;]*;/gi, "").replace(/\\[LlOoKk]/g, "")
      .replace(/\\([{}\\])/g, "$1").replace(/[{}]/g, "");
  }

  function sampleArc(center, radius, start, sweep, ratio = 1, rotation = 0) {
    if (!point(center) || !Number.isFinite(radius) || radius <= 0) return [];
    const count = Math.max(2, Math.min(512, Math.ceil(Math.abs(sweep) / (Math.PI / 90))));
    const c = Math.cos(rotation), s = Math.sin(rotation), result = [];
    for (let i = 0; i <= count; i++) {
      const angle = start + sweep * i / count;
      const x = radius * Math.cos(angle), y = radius * ratio * Math.sin(angle);
      result.push({ x: center.x + c * x - s * y, y: center.y + s * x + c * y });
    }
    return result;
  }

  function positiveSweep(start, end) {
    const raw = end - start;
    return Math.abs(raw) >= TAU - 1e-8 ? TAU : ((raw % TAU) + TAU) % TAU;
  }

  function polyline(vertices, closed) {
    const valid = vertices.filter(point);
    if (valid.length < 2) return valid;
    const result = [valid[0]], segments = valid.length - (closed ? 0 : 1);
    for (let i = 0; i < segments; i++) {
      const a = valid[i], b = valid[(i + 1) % valid.length];
      const bulge = finite(a.bulge), chord = Math.hypot(b.x - a.x, b.y - a.y);
      if (Math.abs(bulge) < 1e-9 || chord < 1e-9) { result.push(b); continue; }
      const offset = chord * (1 - bulge * bulge) / (4 * bulge);
      const center = { x: (a.x + b.x) / 2 - (b.y - a.y) / chord * offset,
        y: (a.y + b.y) / 2 + (b.x - a.x) / chord * offset };
      result.push(...sampleArc(center, Math.hypot(a.x - center.x, a.y - center.y),
        Math.atan2(a.y - center.y, a.x - center.x), 4 * Math.atan(bulge)).slice(1));
    }
    return result;
  }

  function spline(entity) {
    const controls = entity.controlPoints || [], knots = entity.knots || [];
    const degree = Math.floor(finite(entity.degree));
    if (degree < 1 || degree > 10 || controls.length <= degree || knots.length !== controls.length + degree + 1 || !controls.every(point)) return [];
    const start = knots[degree], end = knots[controls.length];
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const result = [], count = Math.min(2048, Math.max(80, controls.length * 12));
    for (let i = 0; i <= count; i++) {
      const t = start + (end - start) * i / count;
      let span = controls.length - 1;
      if (i !== count) {
        span = degree;
        while (span < controls.length - 1 && t >= knots[span + 1]) span++;
      }
      const work = [];
      for (let j = 0; j <= degree; j++) {
        const index = span - degree + j, w = finite(entity.weights?.[index], 1);
        work.push([controls[index].x * w, controls[index].y * w, w]);
      }
      for (let r = 1; r <= degree; r++) {
        for (let j = degree; j >= r; j--) {
          const index = span - degree + j, denominator = knots[index + degree - r + 1] - knots[index];
          const alpha = denominator ? (t - knots[index]) / denominator : 0;
          work[j] = work[j].map((v, k) => (1 - alpha) * work[j - 1][k] + alpha * v);
        }
      }
      const value = work[degree];
      if (value[2]) result.push({ x: value[0] / value[2], y: value[1] / value[2] });
    }
    return result;
  }

  function render(database, { maxSide = 3200, monochrome = false, focus = true } = {}) {
    if (!database || !Array.isArray(database.entities)) throw new Error("도면 객체를 확인하지 못했습니다.");
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서 도면 이미지를 만들 수 없습니다.");
    const warnings = new Set(), unsupported = new Map(), primitives = [];
    const blocks = new Map(entries(database, "BLOCK_RECORD").map((block) => [block.name, block]));
    const layers = new Map(entries(database, "LAYER").map((layer) => [layer.name, layer]));
    let entityCount = 0, textCount = 0, paperCount = 0, vertexCount = 0;
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const colors = ["#202020", "#d02020", "#a08000", "#008030", "#008b9b", "#2040d0", "#b020a0", "#202020", "#777777", "#999999"];

    function addBounds(value) {
      if (!point(value) || Math.abs(value.x) > 1e15 || Math.abs(value.y) > 1e15) throw new Error("도면 좌표 범위가 너무 크거나 올바르지 않습니다.");
      bounds.minX = Math.min(bounds.minX, value.x); bounds.maxX = Math.max(bounds.maxX, value.x);
      bounds.minY = Math.min(bounds.minY, value.y); bounds.maxY = Math.max(bounds.maxY, value.y);
    }

    function colorOf(entity, layer, inherited) {
      if (monochrome) return "#202020";
      let value = entity.color, index = entity.colorIndex;
      if (index === 0 && inherited) return inherited;
      if ((value === undefined || value === null) && (!index || index === 256)) { value = layer?.color; index = layer?.colorIndex; }
      if (Number.isFinite(value)) {
        const rgb = value & 0xffffff;
        // White/near-white CAD colors need contrast on a white PDF page.
        return rgb >= 0xeeeeee ? "#202020" : `#${rgb.toString(16).padStart(6, "0")}`;
      }
      if (colors[Math.abs(index)]) return colors[Math.abs(index)];
      if (index > 9 && index < 250) {
        const hue = Math.floor((index - 10) / 10) * 15;
        return `hsl(${hue} 70% 36%)`;
      }
      return "#202020";
    }

    function path(points, matrix, style, { closed = false, fill = false } = {}) {
      if (points.length < 2) return false;
      vertexCount += points.length;
      if (vertexCount > 3000000 || primitives.length >= limit) throw new Error("도면이 너무 복잡합니다. 필요한 구역을 별도 DWG로 저장한 뒤 다시 시도하세요.");
      const transformed = points.filter(point).map((value) => transform(matrix, value));
      if (transformed.length < 2) return false;
      transformed.forEach(addBounds);
      primitives.push({ kind: "path", points: transformed, style, closed, fill });
      return true;
    }

    // Keep true analytic curves for the native Canvas backend. The browser
    // renderer tessellated every circle into 180 points before fitting a page;
    // plant drawings contain enough tiny circles to hit its memory guard.
    function curve(center, radius, start, sweep, matrix, style, ratio = 1, rotation = 0) {
      if (!point(center) || !(radius > 0) || !(ratio > 0)) return false;
      if (primitives.length >= limit) throw new Error("도면 객체 수가 상세 미리보기 한도를 초과했습니다.");
      const c = Math.cos(rotation), s = Math.sin(rotation);
      for (let i = 0; i <= 64; i++) {
        const angle = start + sweep * i / 64;
        const x = radius * Math.cos(angle), y = radius * ratio * Math.sin(angle);
        addBounds(transform(matrix, {x: center.x + c*x - s*y, y: center.y + s*x + c*y}));
      }
      primitives.push({kind: "curve", center, radius, ratio, rotation, start, sweep, matrix, style});
      return true;
    }

    function text(entity, matrix, style) {
      const source = plainText(entity.text);
      if (!source.trim()) return false;
      const isMtext = entity.type === "MTEXT";
      const anchor = isMtext ? entity.insertionPoint : ((entity.halign || entity.valign) && point(entity.endPoint) ? entity.endPoint : entity.startPoint);
      if (!point(anchor)) return false;
      let height = Math.abs(finite(entity.textHeight));
      if (!height) {
        const styleHeight = entries(database, "STYLE").find((style) => style.name === entity.styleName)?.fixedTextHeight;
        height = Math.abs(finite(styleHeight)) || Math.abs(finite(database.header?.TEXTSIZE)) || 2.5;
        warnings.add("문자 높이가 저장되지 않은 객체는 스타일/기본 높이로 표시합니다.");
      }
      ctx.font = `${height}px "Malgun Gothic", "Arial", sans-serif`;
      let lines = source.split(/\r?\n/);
      if (isMtext && entity.rectWidth > height) {
        const wrapped = [];
        for (const line of lines) {
          let current = "";
          for (const char of line) {
            if (current && ctx.measureText(current + char).width > entity.rectWidth) { wrapped.push(current); current = ""; }
            current += char;
          }
          wrapped.push(current);
        }
        lines = wrapped;
      }
      if (lines.length > 5000 || source.length > 100000) { warnings.add("매우 긴 문자 객체는 미리보기에서 일부만 표시합니다. 원문은 객체 JSON에서 확인하세요."); lines = lines.slice(0, 5000).map((line) => line.slice(0, 100000)); }
      const width = Math.max(height * 0.1, ...lines.map((line) => ctx.measureText(line).width));
      const spacing = height * 1.35 * Math.max(0.25, finite(entity.lineSpacing) || 1);
      const totalHeight = height + (lines.length - 1) * spacing;
      let offsetX = 0, offsetY = 0;
      if (isMtext) {
        const attachment = Math.max(1, Math.min(9, finite(entity.attachmentPoint, 1)));
        offsetX = -((attachment - 1) % 3) * width / 2;
        offsetY = [0, -totalHeight / 2, -totalHeight][Math.floor((attachment - 1) / 3)];
      } else {
        offsetX = entity.halign === 1 || entity.halign === 4 ? -width / 2 : entity.halign === 2 ? -width : 0;
        offsetY = entity.valign === 3 ? 0 : entity.valign === 2 ? -height / 2 : -height;
        if (entity.halign === 3 || entity.halign === 5 || entity.obliqueAngle) warnings.add("정렬/기울임 문자의 일부 서식은 기본 글꼴로 근사 표시합니다.");
      }
      let angle = finite(entity.rotation);
      if (isMtext && point(entity.direction) && Math.hypot(entity.direction.x, entity.direction.y) > 1e-9) angle = Math.atan2(entity.direction.y, entity.direction.x);
      const sx = finite(entity.xScale, 1) * ((entity.generationFlag & 2) ? -1 : 1);
      const sy = (entity.generationFlag & 4) ? -1 : 1;
      const placed = multiply(matrix, placement(anchor.x, anchor.y, angle, sx, sy));
      // text coordinates use Y down; placement maps the baseline back to world Y up.
      const textMatrix = multiply(placed, [1, 0, 0, -1, 0, 0]);
      for (const x of [offsetX, offsetX + width]) for (const y of [offsetY, offsetY + totalHeight]) addBounds(transform(textMatrix, { x, y }));
      primitives.push({ kind: "text", matrix: textMatrix, lines, height, spacing, offsetX, offsetY, style });
      textCount++;
      return true;
    }

    function visit(entity, parent = identity, stack = [], inherited = null, parentLayer = null) {
      if (!entity) return;
      if (entity.isInPaperSpace) { paperCount++; return; }
      const layerName = entity.layer === "0" && parentLayer ? parentLayer : entity.layer;
      const layer = layers.get(layerName);
      if (entity.isVisible === false || layer?.off || layer?.frozen || finite(entity.colorIndex, 256) < 0) return;
      const type = String(entity.type || "UNKNOWN").toUpperCase();
      if (["ATTRIB", "ATTDEF"].includes(type)) {
        if (entity.flags & 1) return;
        if (entity.text && typeof entity.text === "object") {
          entity = { ...entity, ...entity.text, type };
          if (entity.mtextFlag) warnings.add("여러 줄 속성 문자는 기본 문자 서식으로 표시합니다.");
        }
      }
      const style = { color: colorOf(entity, layer, inherited), lineType: entity.lineType && !/BYLAYER/i.test(entity.lineType) ? entity.lineType : layer?.lineType };
      if (style.lineType && !/^(?:continuous|bylayer|byblock)$/i.test(style.lineType)) warnings.add("선종류의 간격/패턴은 근사 표시합니다. 원본 출력 스타일과 다를 수 있습니다.");
      const extrusion = entity.extrusionDirection;
      if (extrusion && (Math.abs(finite(extrusion.x)) > 1e-8 || Math.abs(finite(extrusion.y)) > 1e-8)) warnings.add("기울어진 객체는 XY 평면으로 투영합니다. 3D 뷰와 다를 수 있습니다.");
      const matrix = multiply(parent, ocs(entity));
      let drawn = false;
      if (type === "INSERT" || type === "DIMENSION") {
        const block = blocks.get(entity.name);
        if (!block) { unsupported.set(`${type} (블록 없음)`, (unsupported.get(`${type} (블록 없음)`) || 0) + 1); return; }
        if (block.flags & 12) warnings.add("외부참조(XREF)는 DWG에 저장된 객체만 표시합니다. 외부 파일은 불러오지 않습니다.");
        if (stack.includes(block.name) || stack.length >= 32) { warnings.add("순환하거나 너무 깊은 블록 참조를 제외했습니다."); return; }
        const insertion = type === "INSERT" ? entity.insertionPoint : { x: 0, y: 0 };
        if (!point(insertion)) return;
        const rows = Math.max(1, Math.min(1000, finite(entity.rowCount, 1))), cols = Math.max(1, Math.min(1000, finite(entity.columnCount, 1)));
        if (rows * cols > 10000) throw new Error("블록 배열이 너무 큽니다. 필요한 구역만 별도 DWG로 저장하세요.");
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
          let blockMatrix = multiply(matrix, placement(insertion.x, insertion.y, type === "INSERT" ? finite(entity.rotation) : 0,
            type === "INSERT" ? finite(entity.xScale, 1) : 1, type === "INSERT" ? finite(entity.yScale, 1) : 1));
          // MINSERT row/column spacing follows rotation but is not scaled by insertion scale.
          const base = block.basePoint || { x: 0, y: 0 };
          blockMatrix = multiply(blockMatrix, [1, 0, 0, 1, -finite(base.x), -finite(base.y)]);
          if (row || col) {
            const a = finite(entity.rotation), dx = col * finite(entity.columnSpacing), dy = row * finite(entity.rowSpacing);
            const offsetX = Math.cos(a) * dx - Math.sin(a) * dy, offsetY = Math.sin(a) * dx + Math.cos(a) * dy;
            blockMatrix[4] += matrix[0] * offsetX + matrix[2] * offsetY;
            blockMatrix[5] += matrix[1] * offsetX + matrix[3] * offsetY;
          }
          for (const child of block.entities || []) {
            if (child.type !== "ATTDEF" || (child.flags & 2)) visit(child, blockMatrix, [...stack, block.name], style.color, layerName);
          }
        }
        for (const attribute of entity.attribs || []) visit(attribute, parent, stack, style.color, layerName);
        return;
      }
      if (type === "LINE") {
        if (Math.abs(finite(entity.startPoint?.z) - finite(entity.endPoint?.z)) > 1e-8) warnings.add("높이가 변하는 3D 선분은 XY 평면으로 투영합니다.");
        drawn = path([entity.startPoint, entity.endPoint], parent, style);
      }
      else if (type === "CIRCLE" || type === "ARC") {
        const start = type === "CIRCLE" ? 0 : finite(entity.startAngle), sweep = type === "CIRCLE" ? TAU : positiveSweep(start, finite(entity.endAngle));
        drawn = curve(entity.center, finite(entity.radius), start, sweep, matrix, style);
      } else if (type === "ELLIPSE") {
        const major = entity.majorAxisEndPoint || {}, radius = Math.hypot(finite(major.x), finite(major.y));
        drawn = curve(entity.center, radius, finite(entity.startAngle), positiveSweep(finite(entity.startAngle), finite(entity.endAngle, TAU)),
          parent, style, finite(entity.axisRatio, 1), Math.atan2(finite(major.y), finite(major.x)));
      } else if (["LWPOLYLINE", "POLYLINE2D", "POLYLINE3D"].includes(type)) {
        if (type === "POLYLINE3D") warnings.add("3D 폴리선은 XY 평면으로 투영합니다.");
        if (type !== "LWPOLYLINE" && entity.flag & 6) warnings.add("곡선 맞춤 폴리선은 저장된 정점과 벌지로 근사 표시합니다.");
        const closed = !!(entity.flag & (type === "LWPOLYLINE" ? 0x200 : 1));
        if (entity.constantWidth || entity.startWidth || entity.endWidth || entity.vertices?.some((vertex) => vertex.startWidth || vertex.endWidth)) warnings.add("폭이 있는 폴리선은 중심선으로 표시합니다.");
        drawn = path(polyline(entity.vertices || [], closed), type === "POLYLINE3D" ? parent : matrix, style, { closed });
      } else if (["TEXT", "MTEXT", "ATTRIB", "ATTDEF"].includes(type)) drawn = text(entity, matrix, style);
      else if (["SOLID", "TRACE", "3DFACE"].includes(type)) {
        if (type === "3DFACE") warnings.add("3D 면은 XY 평면으로 투영합니다.");
        const corners = (type === "3DFACE" ? [entity.corner1, entity.corner2, entity.corner3, entity.corner4 || entity.corner3]
          : [entity.corner1, entity.corner2, entity.corner4 || entity.corner3, entity.corner3]).filter(point);
        drawn = path(corners, type === "3DFACE" ? parent : matrix, style, { closed: true, fill: type !== "3DFACE" });
      } else if (type === "POINT" && point(entity.position)) {
        const location = transform(parent, entity.position); addBounds(location);
        primitives.push({ kind: "point", position: location, style }); drawn = true;
      } else if (type === "SPLINE") {
        const points = spline(entity);
        if (points.length) drawn = path(points, parent, style, { closed: !!(entity.flag & 1) });
        else warnings.add("제어점/매듭이 없는 스플라인은 미리보기에서 제외했습니다.");
      } else if (type === "LEADER") {
        drawn = path(entity.vertices || [], parent, style);
        warnings.add("지시선은 저장된 정점으로 표시하며 화살표/곡선 서식은 근사합니다.");
      } else if (type === "HATCH") {
        for (const boundary of entity.boundaryPaths || []) {
          if (boundary.vertices) drawn = path(polyline(boundary.vertices, boundary.isClosed), matrix, style, { closed: boundary.isClosed }) || drawn;
          else for (const edge of boundary.edges || []) {
            if (edge.type === 1) drawn = path([edge.start, edge.end], matrix, style) || drawn;
            else if (edge.type === 2) {
              const sweep = edge.isCCW === false ? -positiveSweep(finite(edge.endAngle), finite(edge.startAngle)) : positiveSweep(finite(edge.startAngle), finite(edge.endAngle));
              drawn = path(sampleArc(edge.center, finite(edge.radius), finite(edge.startAngle), sweep), matrix, style) || drawn;
            } else warnings.add("일부 해치 경계 곡선을 표시하지 못했습니다.");
          }
        }
        warnings.add("해치는 경계선만 표시합니다. 채움/패턴/그라데이션은 재현하지 않습니다.");
      } else {
        unsupported.set(type, (unsupported.get(type) || 0) + 1);
        return;
      }
      if (drawn) entityCount++;
      else unsupported.set(`${type} (좌표 없음)`, (unsupported.get(`${type} (좌표 없음)`) || 0) + 1);
    }

    for (const entity of database.entities) visit(entity);
    if (paperCount || entries(database, "BLOCK_RECORD").some((block) => /^\*paper_space/i.test(block.name) && block.entities?.length)) warnings.add("PDF/미리보기에는 모형 공간만 포함합니다. 배치(종이 공간)/뷰포트/출력 스타일은 포함하지 않습니다.");
    if (textCount) warnings.add("문자는 설치된 기본 글꼴로 표시합니다. SHX/원본 글꼴과 줄바꿈·폭이 다를 수 있습니다.");
    for (const [type, count] of unsupported) warnings.add(`미리보기에서 지원하지 않거나 표시할 수 없는 객체: ${type} ${count}개`);
    if (!entityCount || !Number.isFinite(bounds.minX)) throw new Error(`표시할 수 있는 모형 공간의 2D 객체가 없습니다.${warnings.size ? ` ${[...warnings].join(" ")}` : ""}`);
    const fullBounds = { ...bounds };
    let autoFocusUsed = false;
    if (focus && primitives.length > 100) {
      const xs = [], ys = [];
      const add = (p) => { if (point(p)) { xs.push(p.x); ys.push(p.y); } };
      for (const primitive of primitives) {
        if (primitive.kind === "path") for (const p of primitive.points) add(p);
        else if (primitive.kind === "curve") add(transform(primitive.matrix, primitive.center));
        else if (primitive.kind === "point") add(primitive.position);
        else add({x: primitive.matrix[4], y: primitive.matrix[5]});
      }
      xs.sort((a,b) => a-b); ys.sort((a,b) => a-b);
      const low = Math.floor(xs.length * 0.001), high = Math.min(xs.length-1, Math.ceil(xs.length * 0.999));
      const proposed = {minX: xs[low], maxX: xs[high], minY: ys[low], maxY: ys[high]};
      const fullSpan = Math.max(bounds.maxX-bounds.minX, bounds.maxY-bounds.minY);
      const focusSpan = Math.max(proposed.maxX-proposed.minX, proposed.maxY-proposed.minY);
      if (focusSpan > 0 && fullSpan > focusSpan * 4) {
        proposed.minX -= focusSpan * 0.08; proposed.maxX += focusSpan * 0.08;
        proposed.minY -= focusSpan * 0.08; proposed.maxY += focusSpan * 0.08;
        Object.assign(bounds, proposed); autoFocusUsed = true;
        warnings.add("멀리 떨어진 객체 때문에 전체 범위가 지나치게 넓어 주영역을 확대했습니다. 영역 밖의 객체는 전체 범위 페이지에서 확인하세요.");
      }
    }
    const rawWidth = bounds.maxX - bounds.minX, rawHeight = bounds.maxY - bounds.minY;
    const span = Math.max(rawWidth, rawHeight, 1e-6), width = Math.max(rawWidth, span * 0.015), height = Math.max(rawHeight, span * 0.015);
    const side = Math.max(320, Math.min(6000, Math.round(finite(maxSide, 3200))));
    const padding = Math.max(16, side * 0.02), scale = (side - padding * 2) / Math.max(width, height);
    canvas.width = Math.max(64, Math.ceil(width * scale + padding * 2));
    canvas.height = Math.max(64, Math.ceil(height * scale + padding * 2));
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const centerX = (bounds.minX + bounds.maxX) / 2, centerY = (bounds.minY + bounds.maxY) / 2;
    const view = [scale, 0, 0, -scale, canvas.width / 2 - centerX * scale, canvas.height / 2 + centerY * scale];
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const primitive of primitives) {
      ctx.setTransform(...view);
      ctx.strokeStyle = primitive.style.color; ctx.fillStyle = primitive.style.color;
      ctx.lineWidth = Math.max(1.6, side / 1200) / scale;
      const lineType = String(primitive.style.lineType || "");
      ctx.setLineDash(/dash|hidden|center/i.test(lineType) ? [5 / scale, 3 / scale] : []);
      if (primitive.kind === "path") {
        ctx.beginPath();
        primitive.points.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        if (primitive.closed) ctx.closePath();
        if (primitive.fill) ctx.fill();
        ctx.stroke();
      } else if (primitive.kind === "point") {
        ctx.beginPath(); ctx.arc(primitive.position.x, primitive.position.y, 1.5 / scale, 0, TAU); ctx.fill();
      } else if (primitive.kind === "curve") {
        ctx.transform(...primitive.matrix);
        const [a, b, c, d] = primitive.matrix;
        ctx.lineWidth /= Math.max(1e-12, Math.sqrt(Math.abs(a * d - b * c)));
        ctx.beginPath();
        ctx.ellipse(primitive.center.x, primitive.center.y, primitive.radius, primitive.radius * primitive.ratio,
          primitive.rotation, primitive.start, primitive.start + primitive.sweep, false);
        ctx.stroke();
      } else {
        ctx.transform(...primitive.matrix);
        ctx.font = `${primitive.height}px "Malgun Gothic", "Arial", sans-serif`;
        ctx.textBaseline = "top"; ctx.textAlign = "left";
        primitive.lines.forEach((line, index) => ctx.fillText(line, primitive.offsetX, primitive.offsetY + index * primitive.spacing));
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { canvas, warnings: [...warnings], entityCount, bounds: { ...bounds }, fullBounds, autoFocusUsed };
  }

  Tool.core.cadRender = Object.freeze({ render, collectEntities, plainText });
})(window.HeechangTool);
