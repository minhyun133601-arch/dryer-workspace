// Explicit equipment-to-document links. Only these registered files are shared.
export const EQUIPMENT_DOCUMENTS = Object.freeze({
  'cheerpack-ahu-history': Object.freeze({
    id: 'cheerpack-ahu-history', title: '설비 이력 카드',
    equipmentName: '치어팩 스틱실 공조기',
    filename: '설비 이력 카드.pdf', mimeType: 'application/pdf',
    href: './documents/cheerpack-ahu-history.pdf', preview: './documents/cheerpack-ahu-history-preview.png', updatedAt: '2026-05-11 12:24',
  }),
});

const embeddedPdf = /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/;
const localPdf = /^\.\/documents\/[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/;
const localPreview = /^\.\/documents\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/;
const embeddedPreview = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const documentUrls = new Map();
let documentDialog;

function validDocument(document) {
  return document?.mimeType === 'application/pdf' && typeof document.href === 'string' &&
    (localPdf.test(document.href) || embeddedPdf.test(document.href));
}

export function getEquipmentDocuments(item) {
  if (!Array.isArray(item?.documentIds)) return [];
  return [...new Set(item.documentIds)].flatMap((id) => {
    if (typeof id !== 'string' || !Object.hasOwn(EQUIPMENT_DOCUMENTS, id)) return [];
    const document = EQUIPMENT_DOCUMENTS[id];
    return validDocument(document) ? [document] : [];
  });
}

export function documentHref(document) {
  if (!validDocument(document)) return '';
  const match = document.href.match(embeddedPdf);
  if (!match) return new URL(document.href, import.meta.url).href;
  if (!documentUrls.has(document.id)) {
    const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
    documentUrls.set(document.id, URL.createObjectURL(new Blob([bytes], { type: document.mimeType })));
  }
  return documentUrls.get(document.id);
}

export function openEquipmentDocument(resource) {
  const href = documentHref(resource);
  if (!href) return false;
  if (!documentDialog) {
    const element = document.createElement('dialog');
    element.id = 'equipment-document-dialog'; element.className = 'equipment-document-dialog';
    element.setAttribute('aria-labelledby', 'equipment-document-dialog-title');
    const header = document.createElement('header'); header.className = 'equipment-document-dialog-header';
    const title = document.createElement('h2'); title.id = 'equipment-document-dialog-title'; title.className = 'equipment-document-dialog-title';
    const toolbar = document.createElement('div'); toolbar.className = 'equipment-document-dialog-toolbar';
    const external = document.createElement('a'); external.className = 'equipment-document-dialog-external';
    external.textContent = '새 탭에서 열기 ↗'; external.target = '_blank'; external.rel = 'noopener noreferrer';
    const download = document.createElement('a'); download.className = 'equipment-document-dialog-download'; download.textContent = 'PDF 저장';
    const close = document.createElement('button'); close.className = 'equipment-document-dialog-close';
    close.type = 'button'; close.textContent = '×'; close.title = '닫기'; close.setAttribute('aria-label', '이력 카드 팝업 닫기');
    close.setAttribute('autofocus', '');
    toolbar.append(external, download); header.append(title, toolbar, close);
    const body = document.createElement('div'); body.className = 'equipment-document-dialog-body';
    const preview = document.createElement('img'); preview.className = 'equipment-document-preview';
    const frame = document.createElement('iframe'); frame.className = 'equipment-document-frame';
    body.append(preview, frame);
    const hint = document.createElement('p'); hint.className = 'equipment-document-dialog-hint';
    hint.textContent = '원본 PDF는 새 탭에서 열거나 저장할 수 있습니다.';
    element.append(header, body, hint);
    close.addEventListener('click', () => element.close());
    element.addEventListener('close', () => {
      if (!element.open) { frame.removeAttribute('src'); preview.removeAttribute('src'); }
    });
    element.addEventListener('keydown', (event) => { if (event.key === 'Escape') event.stopPropagation(); });
    element.addEventListener('click', (event) => { if (event.target === element) element.close(); });
    document.body.append(element);
    documentDialog = { element, title, body, preview, frame, external, download };
  }
  const { element, title, body, preview, frame, external, download } = documentDialog;
  if (typeof element.showModal !== 'function') return false;
  title.textContent = `${resource.equipmentName} · ${resource.title}`;
  frame.title = `${resource.equipmentName} ${resource.title} PDF`;
  const hasPreview = typeof resource.preview === 'string' && (localPreview.test(resource.preview) || embeddedPreview.test(resource.preview));
  preview.hidden = !hasPreview; frame.hidden = hasPreview;
  preview.alt = `${resource.equipmentName} ${resource.title}`;
  if (hasPreview) {
    preview.src = embeddedPreview.test(resource.preview) ? resource.preview : new URL(resource.preview, import.meta.url).href;
    frame.removeAttribute('src');
  } else {
    preview.removeAttribute('src'); frame.src = `${href}#view=FitH`;
  }
  body.scrollTop = 0;
  external.href = download.href = href; download.download = resource.filename;
  if (!element.open) element.showModal();
  return true;
}

export function renderEquipmentDocuments(container, item) {
  const documents = getEquipmentDocuments(item);
  container.replaceChildren();
  container.hidden = !documents.length;
  for (const resource of documents) {
    const row = document.createElement('div'); row.className = 'equipment-document-row';
    const open = document.createElement('a'); open.className = 'equipment-document-open';
    open.href = documentHref(resource); open.target = '_blank'; open.rel = 'noopener noreferrer';
    const badge = document.createElement('span'); badge.className = 'equipment-document-badge'; badge.textContent = 'PDF';
    const text = document.createElement('span'); text.className = 'equipment-document-title';
    const title = document.createElement('strong'); title.textContent = resource.title;
    const description = document.createElement('small'); description.textContent = resource.equipmentName;
    text.append(title, description);
    const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    open.append(badge, text, arrow);
    open.setAttribute('aria-label', `${resource.equipmentName} ${resource.title} PDF 팝업 열기`);
    open.addEventListener('click', (event) => { if (openEquipmentDocument(resource)) event.preventDefault(); });
    const download = document.createElement('a'); download.className = 'equipment-document-download';
    download.href = documentHref(resource); download.download = resource.filename;
    download.textContent = 'PDF 저장'; download.setAttribute('aria-label', `${resource.equipmentName} ${resource.title} PDF 저장`);
    row.append(open, download); container.append(row);
  }
}

export function disposeDocumentUrls() {
  if (documentDialog) {
    if (documentDialog.element.open) documentDialog.element.close();
    documentDialog.element.remove(); documentDialog = undefined;
  }
  for (const url of documentUrls.values()) URL.revokeObjectURL(url);
  documentUrls.clear();
}
