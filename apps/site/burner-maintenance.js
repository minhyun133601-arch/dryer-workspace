// Read-only slide viewer for the local workspace and offline presentation.
export function createBurnerMaintenance(documents) {
  const dialog = document.createElement('dialog');
  dialog.className = 'burner-documents';
  dialog.setAttribute('aria-labelledby', 'burner-document-title');
  dialog.innerHTML = `
    <header class="burner-document-header"><div><p>건조실 버너 · 정비자료</p><h2 id="burner-document-title"></h2></div><button type="button" data-document-close aria-label="정비자료 닫기">닫기 ×</button></header>
    <nav class="burner-document-tabs" aria-label="버너 정비자료 선택"></nav>
    <div class="burner-document-toolbar"><button type="button" data-document-previous aria-label="이전 슬라이드">← 이전</button><output aria-live="polite"></output><button type="button" data-document-next aria-label="다음 슬라이드">다음 →</button><button type="button" data-document-zoom aria-pressed="false">크게 보기</button></div>
    <div class="burner-document-page" tabindex="0"><img alt=""><p class="burner-document-error" hidden>자료를 불러오지 못했습니다.</p></div>
    <footer class="burner-document-footer"><strong></strong><span></span></footer>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let current = documents[0], index = 0, previousFocus, enlarged = false;
  const tabs = new Map();
  for (const record of documents) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = record.title;
    button.addEventListener('click', () => { current = record; index = 0; render(); });
    $('.burner-document-tabs').append(button); tabs.set(record.id, button);
  }
  function render() {
    const slide = current.slides[index];
    $('#burner-document-title').textContent = current.title;
    $('output').textContent = `${index + 1} / ${current.slides.length}쪽`;
    $('[data-document-previous]').disabled = index === 0;
    $('[data-document-next]').disabled = index === current.slides.length - 1;
    for (const [id, button] of tabs) button.setAttribute('aria-pressed', String(id === current.id));
    const image = $('img'), source = slide.image;
    image.src = !source.startsWith('data:') && location.pathname.includes('/site/share/') ? `.${source}` : source;
    image.alt = `${current.title} ${index + 1}쪽 · ${slide.caption}`;
    $('.burner-document-error').hidden = true;
    $('.burner-document-footer strong').textContent = slide.caption;
    $('.burner-document-footer span').textContent = `${current.date} · ${current.note || '원본 슬라이드'}`;
    $('.burner-document-page').scrollTop = 0;
    $('.burner-document-page').scrollLeft = 0;
  }
  function next(delta) { const value = Math.max(0, Math.min(current.slides.length - 1, index + delta)); if (value !== index) { index = value; render(); } }
  function setZoom(value) {
    enlarged = value; dialog.classList.toggle('is-enlarged', enlarged);
    $('[data-document-zoom]').textContent = enlarged ? '화면에 맞춤' : '크게 보기';
    $('[data-document-zoom]').setAttribute('aria-pressed', String(enlarged));
  }
  function close() { if (dialog.open) dialog.close(); }
  function open(id) {
    current = documents.find(record => record.id === id) || documents[0];
    if (!current?.slides.length) return;
    previousFocus = document.activeElement; index = 0; setZoom(false); render();
    if (!dialog.open) dialog.showModal();
    $('[data-document-close]').focus();
  }
  $('[data-document-close]').addEventListener('click', close);
  $('[data-document-previous]').addEventListener('click', () => next(-1));
  $('[data-document-next]').addEventListener('click', () => next(1));
  $('[data-document-zoom]').addEventListener('click', () => setZoom(!enlarged));
  $('img').addEventListener('error', () => { $('.burner-document-error').hidden = false; });
  dialog.addEventListener('close', () => previousFocus?.focus?.());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); next(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); next(1); }
  });
  return { open, close, dispose() { close(); dialog.remove(); } };
}
