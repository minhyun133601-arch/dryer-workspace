import { BURNER_SERVICE_EQUIPMENT, BURNER_SPECIFICATIONS, BURNER_SUPPLIER_CONTACT, BURNER_PART_SPECIFICATIONS, BURNER_UNCONFIRMED_SPECIFICATIONS, createBurnerServiceStore, getReplacementStatus, localDateString } from './burner-service-data.js';

const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const labels = { unregistered: '교체일 미등록', scheduled: '예정', upcoming: '교체 임박', due: '오늘 교체 예정', overdue: '교체일 경과' };
const attention = status => ['upcoming', 'due', 'overdue'].includes(status.state);
const formatDate = value => value ? value.replaceAll('-', '.') : '—';
const remaining = status => status.daysRemaining === null ? '최근 교체일을 입력해 주세요.' : status.daysRemaining < 0 ? `${-status.daysRemaining}일 경과` : status.daysRemaining === 0 ? 'D-DAY' : `D-${status.daysRemaining}`;

// Management belongs to the interactive equipment viewer. Presentation mode
// does not instantiate this module or acquire a store/listener/timer.
export function createBurnerService({ dialog, onOpen = () => {}, onSelectPart = () => {}, onShowDrawing = () => {} }) {
  const store = createBurnerServiceStore();
  const layout = dialog.querySelector('.furnace-layout');
  const footer = dialog.querySelector('.furnace-footer');
  const drawingSource = dialog.querySelector('[data-furnace-source="drawing"]');
  const nav = document.createElement('nav');
  nav.className = 'bs-nav';
  nav.setAttribute('aria-label', '버너 상세 메뉴');
  nav.innerHTML = `<div class="bs-tabs"><button type="button" data-bs-view="drawing" aria-pressed="true">구조 분해도</button><button type="button" data-bs-view="specifications" aria-pressed="false">기본 사양</button><button type="button" data-bs-view="equipment" aria-pressed="false">설비·교체 관리 <span data-bs-count>0</span></button><button type="button" data-bs-view="history" aria-pressed="false">정비 이력</button></div><span class="bs-nav-note">모터 베어링 1년 · 나머지 2년</span>`;
  const alert = document.createElement('div');
  alert.className = 'bs-alert'; alert.hidden = true;
  alert.innerHTML = `<div role="alert" aria-atomic="true"><strong></strong><span></span></div><button type="button" data-bs-alert-open>교체 대상 보기 →</button><button type="button" data-bs-dismiss aria-label="교체 알람 닫기">×</button>`;
  const panel = document.createElement('section');
  panel.className = 'bs-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', '버너 설비 관리');
  panel.innerHTML = `
    <section class="bs-specifications" aria-label="버너 기본 사양" hidden>
      <header class="bs-page-head"><div><h3>버너 기본 사양</h3><p>제조사 연락처와 부품별 규격을 확인합니다. 도면 사양과 현장 확인 내용을 함께 표시합니다.</p></div></header>
      <div class="bs-spec-overview"><article class="bs-spec-identity"><p>${escapeText(BURNER_SUPPLIER_CONTACT.name)}</p><h4>KHMA-H760</h4><strong>2,400,000 <small>kcal/h</small></strong><span>SIDE PLATE TYPE BURNER SYSTEM</span><div class="bs-spec-actions"><button type="button" data-bs-spec-equipment>교체·업체 관리 →</button><button type="button" data-bs-spec-drawing>분해도 보기 ↗</button></div></article><aside class="bs-spec-contact"><h4>제조사 연락처</h4><dl><div><dt>대표전화</dt><dd>${BURNER_SUPPLIER_CONTACT.phoneNumbers.map(phone => `<a href="tel:${escapeText(phone.replace(/[^\d+]/g, ''))}">${escapeText(phone)}</a>`).join(' / ')}</dd></div><div><dt>상담시간</dt><dd>${escapeText(BURNER_SUPPLIER_CONTACT.hours)}</dd></div><div><dt>이메일</dt><dd><a href="mailto:${escapeText(BURNER_SUPPLIER_CONTACT.email)}">${escapeText(BURNER_SUPPLIER_CONTACT.email)}</a></dd></div><div><dt>주소</dt><dd>${escapeText(BURNER_SUPPLIER_CONTACT.address)}</dd></div></dl><a class="bs-spec-official" href="${escapeText(BURNER_SUPPLIER_CONTACT.sourceUrl)}" target="_blank" rel="noopener noreferrer">공식 고객센터 ↗</a></aside></div>
      <dl class="bs-spec-grid">${BURNER_SPECIFICATIONS.map(row => `<div><dt>${escapeText(row.label)}</dt><dd>${escapeText(row.value)}</dd></div>`).join('')}</dl>
      <div class="bs-spec-caution"><strong>도면과 현장이 다른 부품 ${BURNER_PART_SPECIFICATIONS.filter(part => part.fieldStatus === 'differs').length}개</strong><p>압력스위치와 유량 조절 모터는 현장 제품이 도면과 다릅니다. 교체 부품을 발주할 때는 현재 설치된 부품의 명판을 확인하세요.</p></div>
      <div class="bs-spec-parts-head"><div><h4>부품 명칭·규격</h4><span>번호는 분해도 표시와 연결됩니다.</span></div><div class="bs-spec-tools"><label>부품 검색<input type="search" aria-label="부품 사양 검색" placeholder="부품명·제조사·모델 검색"></label><label><input type="checkbox" data-bs-spec-differs>현장 다른 부품만</label></div></div>
      <p class="bs-spec-results" aria-live="polite"></p><div class="bs-spec-table"><table><caption>버너 부품별 도면 규격과 현장 확인 정보</caption><thead><tr>${['도면 번호', '부품 명칭', '규격·모델', '제조사', '확인 근거', '보기'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
      <div class="bs-spec-unconfirmed"><h4>명판·현장에서 추가 확인할 항목</h4><ul>${BURNER_UNCONFIRMED_SPECIFICATIONS.map(item => `<li>${escapeText(item)}</li>`).join('')}</ul><p>제조일·설치일은 도면 작성일과 다릅니다. 교체 주기는 현재 설정한 관리 기준이며, 제조사 공식 권장 주기로 표시하지 않습니다.</p></div>
    </section>
    <section class="bs-equipment" aria-label="설비·교체 관리">
      <header class="bs-page-head"><div><h3>설비·교체 관리</h3><p>교체 일정과 정비 업체를 설비별로 확인하고 관리합니다.</p></div><label class="bs-lead"><span>교체 알람</span><input type="number" min="0" max="365" step="1" aria-label="교체 알람 사전 일수"><span>일 전부터</span></label></header>
      <div class="bs-stats" aria-label="교체 현황"></div>
      <div class="bs-workspace"><aside class="bs-catalog"><div class="bs-search"><label>관리 설비<input type="search" placeholder="설비명 검색" aria-label="설비 검색"></label><label class="bs-only-alert"><input type="checkbox">교체 대상만 보기</label></div><div class="bs-list" aria-label="관리 설비 목록"></div></aside><div class="bs-editor"></div></div>
    </section>
    <section class="bs-history" aria-label="정비 이력 양식" hidden>
      <header class="bs-page-head"><div><p class="bs-eyebrow">BURNER / SERVICE HISTORY</p><h3>정비 이력 <span class="bs-template-tag">양식</span></h3><p>정비 기록을 작성할 때 사용할 기본 항목입니다.</p></div></header>
      <div class="bs-history-context"><span>설비명<strong>건조실 버너</strong></span><span>모델<strong>KHMA-H760</strong></span><span>관리 부서<strong>________________</strong></span></div>
      <div class="bs-history-table"><table><caption>버너 정비 이력 빈 양식</caption><thead><tr>${['정비일자', '설비명 / 부품', '작업 구분', '정비·교체 내용', '업체명 / 연락처', '작업자', '다음 교체일', '비고'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${Array.from({length: 5}, (_, i) => `<tr aria-label="빈 정비 이력 ${i + 1}행">${Array.from({length: 8}, () => '<td><span aria-hidden="true">&nbsp;</span></td>').join('')}</tr>`).join('')}</tbody></table></div>
      <p class="bs-history-note">작성 항목 · 작업 구분: 점검 / 수리 / 교체 &nbsp; · &nbsp; 정비 내용: 증상, 조치, 교체 부품 및 규격</p><div class="bs-history-empty"><span aria-hidden="true">＋</span><strong>정비 이력을 위한 빈 양식입니다.</strong><p>실제 정비 기록은 입력되어 있지 않습니다.</p></div>
    </section>
    <p class="bs-storage-note">입력한 설비 정보는 이 브라우저에 저장됩니다. 교체 알람은 프로젝트 화면을 실행 중일 때 표시됩니다.</p><p class="bs-message" role="status" aria-live="polite"></p>`;
  layout.before(nav, alert); footer.before(panel);
  const globalAlert = document.createElement('aside');
  globalAlert.className = 'bs-global-alert'; globalAlert.hidden = true;
  globalAlert.setAttribute('aria-label', '버너 교체 알람');
  globalAlert.innerHTML = '<div role="alert"><strong>버너 교체 알람</strong><p></p></div><button type="button" data-bs-global-open>교체 대상 보기 →</button><button type="button" data-bs-global-dismiss aria-label="버너 교체 알람 닫기">×</button>';
  document.body.append(globalAlert);
  const $ = selector => panel.querySelector(selector);
  let view = 'drawing', selectedId = BURNER_SERVICE_EQUIPMENT[0].id, query = '', specQuery = '', specDiffersOnly = false, specSelectedId = null, alertsOnly = false, dismissed = false, globalDismissed = false, timer = null, opened = false, disposed = false, linkingDrawing = false;
  const drafts = new Map();
  const records = () => store.getRecords();
  const statusOf = record => getReplacementStatus(record, localDateString(), store.getLeadDays());
  const message = (text, error = false) => { $('.bs-message').textContent = text; $('.bs-message').classList.toggle('is-error', error); };
  const byId = id => records().find(record => record.id === id);
  function renderSpecifications() {
    const term = specQuery.trim().toLocaleLowerCase();
    const parts = BURNER_PART_SPECIFICATIONS.filter(part => (!specDiffersOnly || part.fieldStatus === 'differs') && [part.id, part.name, part.model, part.maker, part.drawingModel, part.drawingMaker].join(' ').toLocaleLowerCase().includes(term));
    $('.bs-spec-results').textContent = `${parts.length}개 표시 / 전체 ${BURNER_PART_SPECIFICATIONS.length}개`;
    $('.bs-spec-table tbody').innerHTML = parts.length ? parts.map(part => `<tr${part.id === specSelectedId ? ' class="is-selected"' : ''} data-bs-spec-row="${escapeText(part.id)}"><td>${escapeText(part.id)}</td><th scope="row">${escapeText(part.name)}</th><td><strong>${escapeText(part.model || '미확인')}</strong>${part.fieldStatus === 'differs' ? `<small>도면: ${escapeText(part.drawingModel)}</small>` : ''}</td><td>${escapeText(part.maker || '미확인')}${part.fieldStatus === 'differs' ? `<small>도면: ${escapeText(part.drawingMaker)}</small>` : ''}</td><td><span class="bs-spec-source ${part.fieldStatus === 'differs' ? 'is-differs' : part.sourceLabel.includes('현장') ? 'is-field' : 'is-drawing'}">${escapeText(part.sourceLabel)}</span>${part.note ? `<details><summary>확인 내용</summary><p>${escapeText(part.note)}</p></details>` : ''}</td><td><button type="button" class="bs-spec-part-view" data-bs-spec-part="${escapeText(part.id)}" aria-label="${escapeText(part.name)} 분해도 보기">분해도 ↗</button><button type="button" class="bs-spec-part-manage" data-bs-spec-maintenance="${escapeText(part.id)}" aria-label="${escapeText(part.name)} 교체 관리">교체 관리 →</button></td></tr>`).join('') : '<tr><td colspan="6">검색 조건에 맞는 부품이 없습니다.</td></tr>';
  }
  function showSpecifications(partId = null) {
    specSelectedId = partId;
    specQuery = ''; specDiffersOnly = false;
    $('.bs-spec-tools input[type=search]').value = '';
    $('[data-bs-spec-differs]').checked = false;
    showView('specifications');
    if (partId) $('.bs-spec-table').querySelector(`[data-bs-spec-row="${CSS.escape(partId)}"]`)?.scrollIntoView({ block: 'nearest' });
    else panel.scrollTop = 0;
  }
  function rememberDraft() {
    const form = $('.bs-editor form');
    if (!form || !form.dataset.dirty) return;
    const patch = {};
    for (const name of ['name', 'lastReplacementDate', 'vendorName', 'vendorPhone']) patch[name] = form.elements.namedItem(name).value;
    drafts.set(form.dataset.record, patch);
  }
  function refreshOverview() {
    const items = records(), statuses = items.map(statusOf), upcoming = statuses.filter(attention), overdue = statuses.filter(status => status.state === 'overdue'), unregistered = statuses.filter(status => status.state === 'unregistered');
    nav.querySelector('[data-bs-count]').textContent = upcoming.length;
    nav.querySelector('[data-bs-count]').classList.toggle('has-alert', upcoming.length > 0);
    $('.bs-stats').innerHTML = `<div><span>관리 설비</span><strong>${items.length}<small>개</small></strong></div><div class="${upcoming.length ? 'is-warn' : ''}"><span>교체 확인 대상</span><strong>${upcoming.length}<small>개</small></strong></div><div class="${overdue.length ? 'is-danger' : ''}"><span>교체일 경과</span><strong>${overdue.length}<small>개</small></strong></div><div><span>교체일 미등록</span><strong>${unregistered.length}<small>개</small></strong></div>`;
    alert.hidden = !opened || dismissed || upcoming.length === 0;
    globalAlert.hidden = opened || globalDismissed || upcoming.length === 0;
    globalAlert.querySelector('p').textContent = `교체 시기 확인 ${upcoming.length}개 · 교체일 경과 ${overdue.length}개`;
    if (upcoming.length) {
      alert.querySelector('strong').textContent = `교체 시기 확인이 필요한 설비 ${upcoming.length}개`;
      alert.querySelector('span').textContent = `${items.filter(record => attention(statusOf(record))).slice(0, 2).map(record => record.name).join(' · ')}${upcoming.length > 2 ? ` 외 ${upcoming.length - 2}개` : ''} · 교체일 경과 ${overdue.length}개`;
    }
    $('.bs-lead input').value = store.getLeadDays();
    renderList();
  }
  function renderList() {
    const filtered = records().filter(record => record.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (!alertsOnly || attention(statusOf(record))));
    $('.bs-list').innerHTML = filtered.length ? filtered.map(record => {
      const status = statusOf(record);
      return `<button type="button" class="bs-item" data-bs-record="${escapeText(record.id)}" aria-pressed="${record.id === selectedId}"><span class="bs-item-top"><strong>${escapeText(record.name)}</strong><span>${record.cycleYears}년</span></span><span class="bs-item-bottom"><span class="bs-badge ${status.state}">${labels[status.state]}</span><span>${status.dueDate ? formatDate(status.dueDate) : '교체일 입력 필요'}</span></span></button>`;
    }).join('') : '<p class="bs-no-results">조건에 맞는 설비가 없습니다.</p>';
  }
  function renderEditor() {
    const saved = byId(selectedId); if (!saved) return;
    const record = { ...saved, ...drafts.get(selectedId) }, status = statusOf(record);
    $('.bs-editor').innerHTML = `<form data-record="${escapeText(record.id)}"${drafts.has(selectedId) ? ' data-dirty="true"' : ''}>
      <div class="bs-editor-title"><div><p class="bs-eyebrow">선택 설비</p><h4>${escapeText(saved.name)}</h4></div><div class="bs-spec-actions"><button type="button" class="bs-text-button" data-bs-equipment-spec>부품 사양</button><button type="button" class="bs-text-button" data-bs-drawing>분해도에서 보기 ↗</button></div></div>
      <div class="bs-form-grid bs-identity-grid"><label>설비 명칭 <span class="bs-required">필수</span><input name="name" value="${escapeText(record.name)}" required maxlength="100" autocomplete="off"></label><div class="bs-cycle"><span>교체 주기</span><strong>${record.cycleYears}<small>년마다 교체</small></strong><p>${record.cycleYears === 1 ? '모터 베어링 1년' : '팬·나머지 구성품 2년'}</p></div></div>
      <div class="bs-detail-columns">
        <section class="bs-schedule" aria-label="선택 설비 교체 일정"><div class="bs-section-head"><h5>교체 일정</h5><span>최근 교체일 기준</span></div><label class="bs-field">최근 교체일<input name="lastReplacementDate" type="date" value="${escapeText(record.lastReplacementDate)}" max="${localDateString()}"><small>설치 후 미교체 시 설치일을 입력하세요.</small></label>
          <div class="bs-due-card ${status.state}" aria-live="polite"><div><span>다음 교체 예정일</span><strong data-bs-due-date>${formatDate(status.dueDate)}</strong></div><div><span class="bs-badge ${status.state}" data-bs-due-label>${labels[status.state]}</span><strong data-bs-remaining>${remaining(status)}</strong></div><p>교체 예정일 ${store.getLeadDays()}일 전부터 알람</p></div>
        </section>
        <section class="bs-contact" aria-label="선택 설비 정비 업체"><div class="bs-section-head"><h5>정비 업체 연락처</h5><span>설비별 등록</span></div><div class="bs-form-grid bs-contact-grid"><label>업체명<input name="vendorName" value="${escapeText(record.vendorName)}" placeholder="업체명 입력" maxlength="100" autocomplete="organization"></label><label>전화번호<input name="vendorPhone" type="tel" value="${escapeText(record.vendorPhone)}" placeholder="전화번호 입력" maxlength="60" autocomplete="tel"></label></div><p class="bs-contact-note">${record.vendorPhone === '031-434-6566~7' ? '대표전화 · 평일 09:00–18:00' : '설비에 맞는 정비 업체와 연락처를 등록해 두세요.'}</p></section>
      </div>
      <div class="bs-form-actions"><span data-bs-save-note>${drafts.has(selectedId) ? '저장하지 않은 변경사항이 있습니다.' : '교체일을 저장하면 알람에 반영됩니다.'}</span><button type="submit" class="bs-save">설비 정보 저장</button></div></form>`;
  }
  function showView(next) {
    rememberDraft(); if (next !== view) panel.scrollTop = 0; view = next;
    layout.hidden = view !== 'drawing'; footer.hidden = view !== 'drawing'; panel.hidden = view === 'drawing';
    dialog.classList.toggle('is-service', view !== 'drawing');
    $('.bs-equipment').hidden = view !== 'equipment'; $('.bs-history').hidden = view !== 'history'; $('.bs-specifications').hidden = view !== 'specifications';
    nav.querySelectorAll('[data-bs-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bsView === view)));
    drawingSource?.setAttribute('aria-pressed', String(view === 'drawing'));
    if (view === 'equipment') { refreshOverview(); renderEditor(); }
    if (view === 'specifications') renderSpecifications();
    if (view === 'drawing') onShowDrawing();
  }
  function selectPart(partId) {
    if (linkingDrawing && byId(selectedId)?.partIds.includes(partId)) return;
    const record = records().find(record => record.id === `part-${partId}`) || records().find(record => record.partIds.includes(partId));
    if (record && record.id !== selectedId) { rememberDraft(); selectedId = record.id; if (view === 'equipment') { renderList(); renderEditor(); } }
  }
  function showEquipment(partId) { if (partId) selectPart(partId); showView('equipment'); }
  nav.addEventListener('click', event => { const button = event.target.closest('[data-bs-view]'); if (button) showView(button.dataset.bsView); });
  $('.bs-spec-tools input[type=search]').addEventListener('input', event => { specQuery = event.target.value; renderSpecifications(); });
  $('[data-bs-spec-differs]').addEventListener('change', event => { specDiffersOnly = event.target.checked; renderSpecifications(); });
  $('[data-bs-spec-equipment]').addEventListener('click', () => showView('equipment'));
  $('[data-bs-spec-drawing]').addEventListener('click', () => showView('drawing'));
  $('.bs-spec-table').addEventListener('click', event => {
    const control = event.target.closest('button'); if (!control) return;
    if (control.dataset.bsSpecMaintenance) showEquipment(control.dataset.bsSpecMaintenance);
    else if (control.dataset.bsSpecPart) { showView('drawing'); onSelectPart(control.dataset.bsSpecPart); }
  });
  const showDrawing = () => showView('drawing');
  drawingSource?.addEventListener('click', showDrawing);
  alert.querySelector('[data-bs-dismiss]').addEventListener('click', () => { dismissed = true; alert.hidden = true; });
  function showAlerts() {
    rememberDraft(); alertsOnly = true; query = ''; $('.bs-search input[type=search]').value = ''; $('.bs-only-alert input').checked = true;
    const target = records().filter(record => attention(statusOf(record))).sort((a, b) => statusOf(a).daysRemaining - statusOf(b).daysRemaining)[0];
    if (target) selectedId = target.id;
    showView('equipment');
  }
  alert.querySelector('[data-bs-alert-open]').addEventListener('click', showAlerts);
  globalAlert.querySelector('[data-bs-global-open]').addEventListener('click', () => { onOpen(); showAlerts(); });
  globalAlert.querySelector('[data-bs-global-dismiss]').addEventListener('click', () => { globalDismissed = true; globalAlert.hidden = true; });
  $('.bs-search input[type=search]').addEventListener('input', event => { query = event.target.value; renderList(); });
  $('.bs-only-alert input').addEventListener('change', event => { alertsOnly = event.target.checked; renderList(); });
  $('.bs-list').addEventListener('click', event => { const button = event.target.closest('[data-bs-record]'); if (button) { rememberDraft(); selectedId = button.dataset.bsRecord; renderList(); renderEditor(); } });
  $('.bs-lead input').addEventListener('change', event => {
    if (!event.target.reportValidity() || event.target.value === '') { event.target.value = store.getLeadDays(); return; }
    rememberDraft(); const outcome = store.setLeadDays(Number(event.target.value)); renderEditor();
    message(outcome.saved ? '교체 알람 기준을 저장했습니다.' : `저장하지 못했습니다. ${outcome.error || '브라우저 저장 공간을 확인해 주세요.'}`, !outcome.saved);
  });
  $('.bs-editor').addEventListener('click', event => {
    if (event.target.closest('[data-bs-equipment-spec]')) { showSpecifications(byId(selectedId).partIds[0] || null); return; }
    if (event.target.closest('[data-bs-drawing]')) {
      const record = byId(selectedId); showView('drawing'); linkingDrawing = true;
      try { onSelectPart(record.partIds[0] || null); } finally { linkingDrawing = false; }
    }
  });
  $('.bs-editor').addEventListener('input', event => {
    const form = event.target.closest('form'); if (!form) return;
    form.dataset.dirty = 'true'; form.querySelector('[data-bs-save-note]').textContent = '저장하지 않은 변경사항이 있습니다.';
    const record = { ...byId(selectedId), lastReplacementDate: form.elements.namedItem('lastReplacementDate').value }, status = statusOf(record);
    const due = form.querySelector('.bs-due-card'); due.className = `bs-due-card ${status.state}`;
    form.querySelector('[data-bs-due-date]').textContent = formatDate(status.dueDate);
    form.querySelector('[data-bs-due-label]').textContent = labels[status.state]; form.querySelector('[data-bs-due-label]').className = `bs-badge ${status.state}`;
    form.querySelector('[data-bs-remaining]').textContent = remaining(status);
    message('');
  });
  $('.bs-editor').addEventListener('submit', event => {
    event.preventDefault(); if (!event.target.reportValidity()) return;
    rememberDraft(); const outcome = store.updateRecord(selectedId, drafts.get(selectedId) || {});
    if (outcome.saved) drafts.delete(selectedId);
    renderEditor();
    message(outcome.saved ? '설비 정보와 업체 연락처를 이 브라우저에 저장했습니다.' : `저장하지 못했습니다. ${outcome.error || '브라우저 저장 공간을 확인해 주세요.'}`, !outcome.saved);
  });
  const unsubscribe = store.subscribe(() => refreshOverview());
  function refresh() { rememberDraft(); store.refresh(); refreshOverview(); if (view === 'equipment' && !$('.bs-editor').contains(document.activeElement)) renderEditor(); }
  function onStorage(event) { if (event.key === null || event.key === 'dryer-burner-service-v1') refresh(); }
  function onVisibility() { if (!document.hidden) refresh(); }
  window.addEventListener('storage', onStorage); document.addEventListener('visibilitychange', onVisibility);
  function close() { rememberDraft(); opened = false; alert.hidden = true; if (!disposed) refreshOverview(); }
  function open() {
    if (disposed) return;
    opened = true; dismissed = false; refresh(); showView('drawing');
  }
  function dispose() { disposed = true; close(); clearInterval(timer); unsubscribe(); store.dispose(); window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVisibility); drawingSource?.removeEventListener('click', showDrawing); nav.remove(); alert.remove(); globalAlert.remove(); panel.remove(); }
  refreshOverview(); renderEditor();
  timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  return { open, close, refresh, dispose, selectPart, showEquipment };
}
