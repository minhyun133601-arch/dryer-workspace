(() => {
  "use strict";
  const atlas = window.PanelAtlas;
  const { $, escape, icon, validUrl } = atlas.utils;
  const resources = atlas.views.createResourceView({ utils: atlas.utils });
  const storage = atlas.services.createStorage(atlas.config.storageKey);
  const store = atlas.state.createPartsStore(window.PARTS, storage, atlas.config.editableKeys);
  const origin = new URL(window.location.href).protocol === "file:" ? "null" : window.location.origin;
  const targetOrigin = origin === "null" ? "*" : origin;
  let currentPart = null;
  let latestPart = null;
  let signature = "";
  let follow = true;
  let scale = 100;
  let statusTimer;

  function tellOpener(message) {
    try { window.opener?.postMessage(message, targetOrigin); } catch {}
  }
  function announce(message) {
    clearTimeout(statusTimer);
    $("#viewerStatus").textContent = message;
    statusTimer = setTimeout(() => { $("#viewerStatus").textContent = ""; }, 3500);
  }
  function displayValue(value) {
    return typeof value === "string" ? value : "";
  }
  function normalizePart(part) {
    if (!part || typeof part !== "object" || typeof part.id !== "string") return null;
    const normalized = {};
    for (const key of ["id", "name", "brand", "model", "tag", "rating", "location", "summary", "photo", "docsTitle", "docsUrl", "sellerName", "sellerUrl", "notes"])
      normalized[key] = displayValue(part[key]);
    normalized.relatedResources = Array.isArray(part.relatedResources) ? part.relatedResources : [];
    return normalized;
  }
  function emptyResource(label) {
    return `<div class="unlinked-resource">${icon(label === "판매처" ? "store" : "doc")}<span>${label} 미등록<br><small>메인 부품맵에서 연결할 수 있습니다.</small></span></div>`;
  }
  function updateFollowUI() {
    $("#followSelection").setAttribute("aria-pressed", String(follow));
    $("#followSelection span").textContent = follow ? "선택 따라가기" : "현재 부품 고정";
    $("#followHint").classList.toggle("is-pinned", !follow);
    $("#followHint").textContent = follow
      ? "메인 부품맵에서 선택한 부품을 따라갑니다. 창을 다른 모니터로 옮겨 함께 보세요."
      : "현재 부품을 고정했습니다. 메인에서 다른 부품을 선택해도 이 정보는 유지됩니다.";
  }
  function renderPart(input, force = false) {
    const part = normalizePart(input);
    if (!part) return;
    const nextSignature = JSON.stringify(Object.fromEntries(Object.entries(part).filter(([key]) => key !== "photo")));
    currentPart = part;
    if (!force && nextSignature === signature) return;
    signature = nextSignature;
    const title = part.name || "이름 없는 부품";
    document.title = `${title} — 부품 상세`;
    const specs = [["제조사", part.brand], ["주요 사양", part.rating], ["설치 위치", part.location]];
    const primaryResources = [
      validUrl(part.docsUrl) ? resources.resourceCard("docs", part) : emptyResource("스펙·매뉴얼"),
      validUrl(part.sellerUrl) ? resources.resourceCard("seller", part) : emptyResource("판매처"),
    ].join("");
    const photo = part.photo ? `<section class="viewer-card photo-card" aria-label="실물 참고 사진"><button type="button" class="photo-open" data-viewer-action="photo" aria-label="실물 사진 크게 보기"><img src="${escape(part.photo)}" alt="${escape(title)} 실물 참고 사진"><span class="photo-enlarge">${icon("photo")}사진 크게 보기</span></button><div class="photo-caption"><span>실물 참고 사진</span><span>클릭하면 확대됩니다</span></div></section>` : "";
    $("#partDetails").innerHTML = [
      `<div class="part-heading"><div class="part-eyebrow"><span class="part-tag">${escape(part.tag || "PART")}</span><span>${escape(part.brand || "제조사 미확인")}</span></div><h1>${escape(title)}</h1><div class="part-model-row"><span class="part-model">${escape(part.model || "모델·형번 미확인")}</span><button type="button" class="tool-button copy-model" data-viewer-action="copy" ${part.model ? "" : "disabled"}>${icon("copy")}형번 복사</button></div></div>`,
      `<div class="part-overview"${photo ? "" : ' style="grid-template-columns:1fr"'}>${photo}<section class="viewer-card specifications"><h2>부품 사양</h2><dl class="spec-list">${specs.map(([label, value]) => `<div class="spec-row"><dt>${label}</dt><dd class="${value ? "" : "empty"}">${escape(value || "확인이 필요합니다")}</dd></div>`).join("")}</dl>${part.summary ? `<p class="summary">${escape(part.summary)}</p>` : ""}</section></div>`,
      `<section class="viewer-card resources-section"><div class="section-heading"><h2>매뉴얼 · 구매처</h2><span>연결 자료 ${resources.resourceCount(part)}개</span></div><div class="resource-grid">${primaryResources}${resources.additionalResourceCards(part)}</div></section>`,
      part.notes ? `<section class="viewer-card notes-section"><h2>확인 사항 · 관리 메모</h2><div class="part-note">${escape(part.notes)}</div></section>` : "",
    ].join("");
    if ($("#largePhotoDialog").open) $("#largePhotoDialog").close();
  }
  function applyScale(nextScale) {
    scale = Math.max(90, Math.min(140, nextScale));
    document.documentElement.style.fontSize = `${16 * scale / 100}px`;
    $("#resetText").textContent = `${scale}%`;
    $("#smallerText").disabled = scale <= 90;
    $("#largerText").disabled = scale >= 140;
  }
  async function copyModel() {
    if (!currentPart?.model) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(currentPart.model);
      else {
        const field = document.createElement("textarea");
        field.value = currentPart.model;
        field.className = "copy-fallback";
        document.body.append(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Clipboard unavailable");
      }
      announce("형번을 복사했습니다.");
    } catch { announce("형번을 선택한 뒤 Ctrl+C로 복사해 주세요."); }
  }
  $("#partDetails").addEventListener("click", (event) => {
    const action = event.target.closest("[data-viewer-action]")?.dataset.viewerAction;
    if (action === "copy") copyModel();
    if (action === "photo" && currentPart?.photo) {
      $("#largePhotoImage").src = currentPart.photo;
      $("#largePhotoTitle").textContent = currentPart.name || "실물 참고 사진";
      $("#largePhotoDialog").showModal();
    }
  });
  $("#closeLargePhoto").addEventListener("click", () => $("#largePhotoDialog").close());
  $("#largePhotoDialog").addEventListener("click", (event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
  });
  $("#followSelection").addEventListener("click", () => {
    follow = !follow;
    updateFollowUI();
    if (follow && latestPart) renderPart(latestPart);
    tellOpener({ type: "panel-atlas:follow", follow });
  });
  $("#smallerText").addEventListener("click", () => applyScale(scale - 10));
  $("#largerText").addEventListener("click", () => applyScale(scale + 10));
  $("#resetText").addEventListener("click", () => applyScale(100));
  $("#printPart").addEventListener("click", () => window.print());
  window.addEventListener("message", (event) => {
    if (!window.opener || event.source !== window.opener || event.origin !== origin) return;
    const message = event.data;
    if (!message || message.type !== "panel-atlas:part") return;
    latestPart = normalizePart(message.part);
    if (!latestPart) return;
    if (message.force === true) {
      follow = true;
      updateFollowUI();
    }
    if (follow || currentPart?.id === latestPart.id) renderPart(latestPart);
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== atlas.config.storageKey || !currentPart) return;
    const refreshed = atlas.state.createPartsStore(window.PARTS, storage, atlas.config.editableKeys);
    const part = refreshed.find(currentPart.id);
    if (part) renderPart(part);
  });
  const requested = new URLSearchParams(window.location.search).get("part");
  const initial = store.find(requested) || store.find(atlas.config.initialSelectedId) || store.parts[0];
  if (initial) renderPart(initial);
  else $("#partDetails").innerHTML = '<p class="empty-state">표시할 부품이 없습니다. 메인 부품맵에서 부품을 선택해 주세요.</p>';
  updateFollowUI();
  tellOpener({ type: "panel-atlas:ready" });
})();
