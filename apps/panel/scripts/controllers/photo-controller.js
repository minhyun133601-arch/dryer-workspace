(() => {
  "use strict";
  window.PanelAtlas.controllers.createPhotoController = function (context) {
    const { $, $$ } = context.utils;
    function mountReferencePhoto() {
      const photo = $(".reference-photo");
      const image = $("img", photo);
      image.src = context.referencePhoto.src;
      image.alt = context.referencePhoto.alt;
      $$("button[data-part]", photo).forEach((button) => button.remove());
      const markers = document.createDocumentFragment();
      context.referencePhoto.markers.forEach((marker) => {
        if (!context.store.find(marker.partId)) return;
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.part = marker.partId;
        button.style.left = `${marker.x}%`;
        button.style.top = `${marker.y}%`;
        button.textContent = marker.number;
        button.title = `${marker.number} · ${marker.label}`;
        button.setAttribute(
          "aria-label",
          `${marker.number} · ${marker.label} 정보`,
        );
        markers.append(button);
      });
      photo.append(markers);
    }
    function updateReferenceLayout() {
      const wrap = $("#referenceWrap");
      const photo = $(".reference-photo", wrap);
      const image = $("img", photo);
      if (
        !image.naturalWidth ||
        !image.naturalHeight ||
        !wrap.clientWidth ||
        !wrap.clientHeight
      )
        return;
      const scale = Math.min(
        wrap.clientWidth / image.naturalWidth,
        wrap.clientHeight / image.naturalHeight,
      );
      // Hotspot percentages must refer to the visible image, without contain letterboxing.
      photo.style.width = `${image.naturalWidth * scale}px`;
      photo.style.height = `${image.naturalHeight * scale}px`;
    }
    function openPhoto() {
      const p = context.selected();
      if (!p?.photo) return;
      $("#photoDialogImage").src = p.photo;
      $("#photoDialogTitle").textContent = `${p.name} · 해당 구역 실물 참고`;
      $("#photoDialog").showModal();
    }
    return { mountReferencePhoto, updateReferenceLayout, openPhoto };
  };
})();
