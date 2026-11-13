'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const BASE = location.pathname.startsWith('/drawing-review/') ? '/drawing-review' : '';
  const embedded = window.parent !== window;
  const pageByDrawing = new Map();
  const statusNames = {unreviewed:'미검토',discuss:'논의 필요',hold:'확인 보류',reviewed:'검토 완료'};
  const defaultState = () => ({status:'unreviewed',starred:false});
  const memory = {
    get(key, fallback='') { try { return localStorage.getItem(`drawingReview.${key}`) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(`drawingReview.${key}`, String(value)); } catch {} }
  };
  let token = memory.get('token');
  let items = [], filtered = [], states = {}, current = null, comments = [], pageIndex = 0;
  let scale = 1, fitScale = 1, imageX = 0, imageY = 0, imageWidth = 0, imageHeight = 0, quarterTurns = 0;
  let pendingPin = null, pinMode = false, showPins = true, onlyStars = false, scope = 'ready';
  let hostActive = true, hostReady = false, listSignature = '';
  let selectionVersion = 0, imageVersion = 0, commentSignature = '', currentPreviewSignature = '';
  let toastTimer, resizeTimer, filterTimer, isPolling = false, isLoadingCatalog = false, lastCatalogSync = 0;
  let deferredCommentFocus = null;
  let drag = null, imageLoaded = false, noticeDismissedFor = '', draftDirty = false;

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = (value) => {
    try {
      const url = new URL(value, location.origin);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return '#';
      const pathname = BASE && /^\/(api|cache|original|thumbnail)(\/|$)/.test(url.pathname) ? BASE + url.pathname : url.pathname;
      return pathname + url.search + url.hash;
    } catch { return '#'; }
  };
  const fileGlyph = '<svg viewBox="0 0 30 36"><path d="M5 2h13l7 7v24H5zM18 2v8h7"/></svg>';
  const emptyGlyph = '<svg class="empty-document" viewBox="0 0 48 60"><path d="M8 3h21l11 11v43H8zM29 3v12h11M16 28h16M16 36h16M16 44h10"/></svg>';
  const pinGlyph = '<svg viewBox="0 0 24 24"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></svg>';

  function notify(message, error=false) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.toggle('error', error);
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 6500 : 3500);
  }

  async function request(path, options={}) {
    const headers = {'X-Review-Token':token, ...options.headers};
    if (options.body && typeof options.body !== 'string') {
      options = {...options, body:JSON.stringify(options.body)};
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(safeUrl(path), {...options,headers,credentials:'same-origin',cache:'no-store'});
    if (response.status === 401) {
      $('accessGate').hidden = false;
      $('accessError').textContent = '접속 코드를 확인해 주세요.';
      throw new Error('접속 코드가 필요합니다.');
    }
    if (!response.ok) {
      let message = `요청을 처리하지 못했습니다 (${response.status}).`;
      try { const body = await response.json(); message = body.error || body.message || message; } catch {}
      throw new Error(message);
    }
    if (options.asBlob) return response.blob();
    return response.json();
  }

  function sizeLabel(bytes) {
    const count = Number(bytes) || 0;
    if (count >= 1048576) return `${(count/1048576).toFixed(1)} MB`;
    if (count >= 1024) return `${Math.round(count/1024)} KB`;
    return `${count} B`;
  }

  function cleanCategory(value) { return String(value || '').replace(/^\d+[_\s]*/, '').replace(/·/g,' · '); }
  function cleanName(item) { return String(item?.name || '').replace(/\.(dwg|dxf|pdf|bak|xls|xlsx|doc|docx|png|jpe?g|tiff?|hwp|zip|pptx?)$/i,''); }
  function stateFor(id) { return states[id] || defaultState(); }
  function previewPages(preview=current?.preview) { return Array.isArray(preview?.pages) ? preview.pages : []; }
  function normalizeWarnings(value) { return Array.isArray(value) ? value.filter(Boolean) : (value ? [String(value)] : []); }
  function isReadyDrawing(item) { return /^\.(dwg|bak|pdf|jpe?g|png)$/i.test(item.ext || '') && item.preview?.status === 'ready' && previewPages(item.preview).length > 0; }
  function categoryRank(item) {
    const value = String(item.category || '');
    if (/전체배치/.test(value)) return 1;
    if (/동별|건축/.test(value)) return 2;
    if (/층별|생산팀/.test(value)) return 3;
    return 4;
  }
  function sortItems() { items.sort((a,b) => categoryRank(a)-categoryRank(b) || String(a.site).localeCompare(String(b.site),'ko') || String(a.name).localeCompare(String(b.name),'ko',{numeric:true}) || a.id.localeCompare(b.id)); }
  function notifyHostReady() {
    if (hostReady || !embedded) return;
    hostReady = true;
    window.parent.postMessage({type:'dryer-workspace:ready',moduleId:'drawings'},location.origin);
  }

  function updateGlobalStats() {
    const done = items.filter((item) => stateFor(item.id).status === 'reviewed').length;
    const percent = items.length ? Math.round(done/items.length*100) : 0;
    $('globalCount').textContent = `${items.length.toLocaleString()}개 자료 · 검토 완료 ${done.toLocaleString()}개`;
    $('libraryCount').textContent = items.length.toLocaleString();
    $('readyCount').textContent = items.filter(isReadyDrawing).length.toLocaleString();
    $('allCount').textContent = items.length.toLocaleString();
    $('candidateCount').textContent = items.filter((item)=>stateFor(item.id).starred).length.toLocaleString();
    $('reviewPercent').textContent = `${percent}%`;
    $('progressBar').style.width = `${percent}%`;
  }

  function addSelectOptions(id, values, allText, transform=(x)=>x) {
    const select = $(id), previous = select.value;
    select.innerHTML = `<option value="">${escape(allText)}</option>` + [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')).map((value)=>`<option value="${escape(value)}">${escape(transform(value))}</option>`).join('');
    if ([...select.options].some((option)=>option.value===previous)) select.value = previous;
  }

  function applyFilters({choose=true, scroll=false}={}) {
    const query = $('search').value.trim().toLocaleLowerCase('ko');
    const terms = query.split(/\s+/).filter(Boolean);
    const site = $('siteFilter').value, category = $('categoryFilter').value, status = $('statusFilter').value;
    filtered = items.filter((item) => {
      const state = stateFor(item.id);
      return (scope==='all' || isReadyDrawing(item)) && (!site || item.site===site) && (!category || item.category===category) && (!status || state.status===status) && (!onlyStars || state.starred) && (!terms.length || terms.every((term)=>item._search.includes(term)));
    });
    const active = !!(query || site || category || status || onlyStars);
    $('filteredCount').textContent = `${active?'검색 결과':scope==='ready'?'바로 볼 수 있는 도면':'전체 원본 자료'} · ${filtered.length.toLocaleString()}개`;
    $('resetFilters').hidden = !active;
    $('positionLabel').textContent = active ? '현재 목록' : scope==='ready' ? '바로 볼 도면' : '전체 자료';
    for (const button of $('scopeOptions').querySelectorAll('button')) {
      const selected = button.dataset.scope===scope;
      button.classList.toggle('selected',selected); button.setAttribute('aria-pressed',String(selected));
    }
    renderList(scroll);
    if ($('overviewDialog').open) renderOverview();
    if (choose && filtered.length && !filtered.some((item)=>item.id===current?.id)) selectDrawing(filtered[0].id);
    else if (choose && !filtered.length) clearSelection();
    updateNavigation();
  }

  function renderList(scroll=false) {
    const signature = JSON.stringify([filtered.map((item)=>[item.id,item.thumbnailUrl,stateFor(item.id)]),current?.id]);
    if (signature===listSignature) {
      if (scroll) $('drawingList').querySelector('.selected')?.scrollIntoView({block:'nearest'});
      return;
    }
    listSignature = signature;
    if (!filtered.length) {
      $('drawingList').innerHTML = '<div class="list-empty">조건에 맞는 자료가 없습니다.<br>검색어나 필터를 바꿔 보세요.</div>';
      return;
    }
    const savedScroll = $('drawingList').scrollTop;
    $('drawingList').innerHTML = filtered.map((item) => {
      const state = stateFor(item.id), selected = current?.id===item.id;
      const format = String(item.ext || '').replace(/^\./,'').toUpperCase() || 'FILE';
      return `<button class="drawing-item${selected?' selected':''}" data-id="${escape(item.id)}" aria-current="${selected?'true':'false'}" role="listitem" title="${escape(item.name)} · ${escape(statusNames[state.status]||'미검토')}">${thumbnail(item,format)}<span class="item-info"><span class="item-name">${escape(cleanName(item))}</span><span class="item-subline"><span class="item-site">${escape(item.site||'미확정')} · ${escape(cleanCategory(item.category))}</span><i class="item-dot ${escape(state.status)}" title="${escape(statusNames[state.status]||'미검토')}"></i>${state.starred?'<span class="item-star" title="사용 후보">★</span>':''}</span><span class="item-reference">${escape(item.id.slice(0,8))}${isReadyDrawing(item)?'':' · 원본 자료'}</span></span></button>`;
    }).join('');
    $('drawingList').scrollTop = savedScroll;
    if (scroll) $('drawingList').querySelector('.selected')?.scrollIntoView({block:'nearest'});
  }

  function thumbnail(item,format=String(item.ext||'').replace(/^\./,'').toUpperCase()) {
    return `<span class="drawing-thumb"><span class="thumb-placeholder">${fileGlyph}<b>${escape(format.slice(0,5))}</b></span>${item.thumbnailUrl?`<img src="${escape(safeUrl(item.thumbnailUrl))}" loading="lazy" decoding="async" alt="" draggable="false">`:''}</span>`;
  }

  function renderOverview() {
    $('overviewCount').textContent = `${filtered.length.toLocaleString()}개 · 전체배치 → 동·건축 → 층별 → 검토 자료`;
    $('overviewGrid').innerHTML = filtered.length ? filtered.map((item,index)=>`<button class="overview-card${current?.id===item.id?' selected':''}" data-overview-id="${escape(item.id)}" title="${escape(item.name)}">${thumbnail(item)}<span class="overview-card-heading"><b>${index+1}</b><span>${escape(cleanName(item))}</span>${stateFor(item.id).starred?'<i title="사용 후보">★</i>':''}</span><small>${escape(item.site||'미확정')} · ${escape(item.id.slice(0,8))}</small></button>`).join('') : '<div class="list-empty">현재 필터에 맞는 자료가 없습니다. 목록에서 필터를 조정해 주세요.</div>';
  }

  function updateNavigation() {
    const index = filtered.findIndex((item)=>item.id===current?.id);
    $('drawingPosition').innerHTML = `${index>=0?index+1:'—'} <span>/ ${filtered.length.toLocaleString()}</span>`;
    $('prevDrawing').disabled = index<=0;
    $('nextDrawing').disabled = index<0 || index>=filtered.length-1;
    const pages = previewPages();
    $('pagePosition').textContent = pages.length ? `${pageIndex+1} / ${pages.length} 쪽` : '미리보기 없음';
    $('prevPage').disabled = !pages.length || pageIndex<=0;
    $('nextPage').disabled = !pages.length || pageIndex>=pages.length-1;
    const hasImage = !!(pages.length && imageLoaded);
    for (const id of ['fitBtn','zoomIn','zoomOut','rotateBtn','pinBtn','showPinsBtn']) $(id).disabled = !hasImage;
    $('starCurrent').disabled = !current;
    $('originalLink').style.pointerEvents = current ? '' : 'none';
    $('originalLink').setAttribute('aria-disabled',current?'false':'true');
    $('submitComment').disabled = !current;
    $('copyCurrent').disabled = !current;
    for (const button of $('statusOptions').querySelectorAll('button')) button.disabled = !current;
    if (current) $('drawingReference').textContent = `도면 ID ${current.id.slice(0,8)} · ${pages.length ? `${pageIndex+1}/${pages.length}쪽` : '원본 자료'}${quarterTurns?` · 보기 ${quarterTurns*90}°`:''}`;
  }

  function clearSelection() {
    if (current) { saveCommentDraft(); pageByDrawing.set(current.id,pageIndex); }
    selectionVersion++;
    imageVersion++;
    current = null; comments = []; pageIndex = 0; imageLoaded = false;
    $('imagePlane').hidden = true;
    $('previewNotice').hidden = true;
    $('drawingTitle').textContent = '선택한 조건의 자료가 없습니다';
    $('drawingContext').textContent = '검색어나 필터를 바꿔 주세요';
    $('drawingReference').textContent = '도면 ID · —';
    showStageMessage('표시할 자료가 없습니다','왼쪽 필터를 초기화하면 전체 자료를 다시 볼 수 있습니다.');
    renderComments();
    updateNavigation();
  }

  async function selectDrawing(id) {
    const item = items.find((entry)=>entry.id===id);
    if (!item) return;
    const changed = current?.id !== id;
    if (current && changed) { saveCommentDraft(); pageByDrawing.set(current.id,pageIndex); }
    const version = ++selectionVersion;
    current = item;
    if (changed) quarterTurns = ((Math.trunc(Number(memory.get(`rotation.${id}`)) || 0)%4)+4)%4;
    deferredCommentFocus = null;
    if (changed) pageIndex = pageByDrawing.get(id) || 0;
    comments = [];
    commentSignature = '';
    if (changed) currentPreviewSignature = '';
    setPinMode(false);
    if (changed) loadCommentDraft(id);
    memory.set('current',id);
    const url = new URL(location.href); url.searchParams.set('drawing',id); history.replaceState(null,'',url);
    updateDrawingHeading();
    renderState();
    renderMetadata();
    renderList(true);
    renderComments();
    renderPreview();
    try {
      const detail = await request(`/api/drawings/${encodeURIComponent(id)}`);
      if (version!==selectionVersion || current?.id!==id) return;
      if (detail.preview) current.preview = detail.preview;
      current.detailJob = detail.detailJob || null;
      if (detail.state) states[id] = detail.state;
      comments = Array.isArray(detail.comments) ? detail.comments : [];
      renderState(); renderComments(); renderMetadata(); renderPreview(); updateGlobalStats();
      preloadNext();
    } catch (error) { if (version===selectionVersion) notify(error.message,true); }
  }

  function updateDrawingHeading() {
    if (!current) return;
    $('drawingTitle').textContent = cleanName(current);
    $('drawingTitle').title = current.name;
    $('drawingContext').textContent = [current.site||'공장 미확정',current.building,cleanCategory(current.category)].filter(Boolean).join(' / ');
    $('originalLink').href = safeUrl(current.originalUrl);
  }

  function renderMetadata() {
    if (!current) return;
    $('fileFormat').textContent = String(current.ext||'').replace(/^\./,'').toUpperCase();
    const rows = [['파일명',current.name],['공장',current.site||'미확정'],['동·공간',current.building||'열람 후 확인'],['분류',cleanCategory(current.category)],['용량',sizeLabel(current.bytes)],['출처',`${current.sourceCount||1}곳`],['자료 ID',current.id?.slice(0,12)]];
    $('fileDetails').innerHTML = rows.map(([key,value])=>`<dt>${escape(key)}</dt><dd>${escape(value)}</dd>`).join('');
    const warnings = [...normalizeWarnings(current.warnings),...normalizeWarnings(current.preview?.warnings)];
    $('fileWarnings').textContent = warnings.join('\n');
    const quality = current.preview?.previewQuality;
    const job = current.detailJob;
    const canImprove = ['saved','embedded'].includes(quality) || ['failed','unsupported'].includes(current.preview?.status) && /^(\.)?(dwg|dxf|bak|xls|xlsx|doc|docx|ppt|pptx)$/i.test(current.ext||'');
    const improving = ['queued','running'].includes(job?.status);
    const detailButton = $('detailPreviewBtn');
    detailButton.hidden = !(canImprove || improving || job?.status==='failed');
    detailButton.disabled = improving;
    detailButton.textContent = improving ? (job.status==='queued'?'상세 변환 대기 중…':'상세 변환 중…') : job?.status==='failed' ? '상세 변환 다시 시도' : '선명하게 보기';
    detailButton.title = improving ? '완료되면 도면이 자동으로 바뀝니다.' : '원본으로 상세 미리보기를 만듭니다. 자료에 따라 몇 분 걸릴 수 있습니다.';
    const notice = normalizeWarnings(current.preview?.warnings);
    let noticeText = notice.join(' ');
    if (['saved','embedded'].includes(quality)) noticeText = '저장된 작은 미리보기입니다. 치수·글자를 확인하려면 선명하게 보기를 눌러 주세요.';
    if (improving) noticeText = '원본에서 상세 미리보기를 만들고 있습니다. 몇 분 걸릴 수 있으며, 준비되면 자동으로 바뀝니다.';
    if (job?.status==='failed') noticeText = '상세 미리보기를 만들지 못했습니다. 원본을 열어 확인하거나 다시 시도해 주세요.';
    if ((noticeText || !detailButton.hidden) && (noticeDismissedFor!==current.id || improving || job?.status==='failed')) {
      $('previewNotice').hidden = false;
      $('previewNoticeText').textContent = noticeText || '원본에서 상세 미리보기를 만들 수 있습니다.';
      $('previewNoticeText').title = job?.error || notice.join('\n');
    } else $('previewNotice').hidden = true;
  }

  function renderState() {
    if (!current) return;
    const state = stateFor(current.id);
    for (const button of $('statusOptions').querySelectorAll('button')) {
      const selected = button.dataset.status===state.status;
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
    }
    $('starCurrent').innerHTML = `<span>${state.starred ? '★' : '☆'}</span> 사용 후보`;
    $('starCurrent').classList.toggle('active',!!state.starred);
    $('starCurrent').setAttribute('aria-pressed',String(!!state.starred));
    $('starCurrent').setAttribute('aria-label',state.starred?'현재 도면 사용 후보 해제':'현재 도면 사용 후보로 선택');
    $('stateSaved').textContent = '자동 저장';
    $('stateSaved').classList.remove('saving');
  }

  async function updateState(change) {
    if (!current) return;
    const id = current.id;
    $('stateSaved').textContent = '저장 중…'; $('stateSaved').classList.add('saving');
    try {
      const result = await request(`/api/drawings/${encodeURIComponent(id)}/state`,{method:'POST',body:change});
      states[id] = result.state || result;
      if (current?.id===id) renderState();
      updateGlobalStats(); applyFilters({choose:false});
      if (typeof change.starred==='boolean') notify(change.starred?'사용 후보에 담았습니다.':'사용 후보에서 뺐습니다.');
      if (current?.id===id && !filtered.some((item)=>item.id===id)) {
        notify('상태를 저장했습니다. 현재 필터에 맞는 다음 자료로 이동합니다.');
        if (filtered.length) selectDrawing(filtered[0].id); else clearSelection();
      }
    } catch (error) { notify(`저장 실패: ${error.message}`,true); if (current?.id===id) renderState(); }
  }

  function showStageMessage(title,description,{loading=false,error='',original=false}={}) {
    $('stageMessage').hidden = false;
    $('stageMessage').innerHTML = `${loading?'<span class="loading-ring"></span>':emptyGlyph}<h3>${escape(title)}</h3><p>${escape(description)}</p>${error?`<p class="error-detail">${escape(error)}</p>`:''}${original&&current?`<a class="primary-button" href="${escape(safeUrl(current.originalUrl))}" target="_blank" rel="noopener">원본 파일 열기 ↗</a>`:''}`;
  }

  function renderPreview({force=false}={}) {
    if (!current) return;
    const preview = current.preview || {status:'pending',pages:[]};
    const pages = previewPages(preview);
    pageIndex = Math.max(0,Math.min(pageIndex,Math.max(0,pages.length-1)));
    const signature = JSON.stringify([current.id,preview.status,preview.previewQuality,pages,pageIndex]);
    if (!force && signature===currentPreviewSignature) return;
    currentPreviewSignature = signature;
    const version = ++imageVersion;
    imageLoaded = false;
    $('imagePlane').hidden = true;
    $('stageHint').hidden = true;
    updateNavigation();
    if (!pages.length) {
      if (preview.status==='pending' || preview.status==='processing') showStageMessage('원본으로 확인할 자료입니다','현재 준비된 미리보기가 없습니다. 원본을 열거나 바로 볼 도면에서 검토를 이어가세요.',{original:true});
      else if (preview.status==='failed') showStageMessage('이 자료의 미리보기를 만들지 못했습니다','원본 파일에서 내용을 확인할 수 있습니다.',{error:preview.error||'',original:true});
      else showStageMessage('원본에서 확인할 자료입니다','이 형식은 화면 미리보기를 지원하지 않습니다. 원본 파일을 열어 확인하고, 검토 의견은 이곳에 남겨 주세요.',{error:preview.error||'',original:true});
      return;
    }
    const page = pages[pageIndex];
    showStageMessage('도면을 불러오는 중입니다','잠시만 기다려 주세요.',{loading:true});
    const image = $('drawingImage');
    image.onload = () => {
      if (version!==imageVersion) return;
      imageWidth = image.naturalWidth || Number(page.width) || 1200;
      imageHeight = image.naturalHeight || Number(page.height) || 800;
      imageLoaded = true;
      $('imagePlane').style.width = `${imageWidth}px`;
      $('imagePlane').style.height = `${imageHeight}px`;
      $('imagePlane').hidden = false;
      $('stageMessage').hidden = true;
      $('stageHint').hidden = false;
      fitImage(); renderPins(); updateNavigation();
      if (deferredCommentFocus && deferredCommentFocus.drawingId===current?.id && deferredCommentFocus.page===pageIndex+1) {
        const point=deferredCommentFocus; deferredCommentFocus=null; centerOnPoint(point.x,point.y);
      }
    };
    image.onerror = () => {
      if (version!==imageVersion) return;
      imageLoaded = false;
      showStageMessage('미리보기를 불러오지 못했습니다','파일 준비 상태나 접속을 확인해 주세요. 원본 파일로도 확인할 수 있습니다.',{original:true});
      updateNavigation();
    };
    image.alt = `${current.name} · ${pageIndex+1}쪽`;
    image.src = safeUrl(typeof page==='string' ? page : page.src);
  }

  function fitImage() {
    if (!imageLoaded) return;
    const rect = $('stage').getBoundingClientRect();
    const padding = rect.width < 500 ? 17 : 32;
    const {width,height}=rotatedSize();
    fitScale = Math.min((rect.width-padding*2)/width,(rect.height-padding*2-12)/height);
    fitScale = Math.max(.005,fitScale);
    scale = fitScale;
    imageX = (rect.width-width*scale)/2;
    imageY = (rect.height-height*scale)/2-4;
    transformImage();
  }

  function transformImage() {
    const offsetX=quarterTurns===1?imageHeight:quarterTurns===2?imageWidth:0;
    const offsetY=quarterTurns===2?imageHeight:quarterTurns===3?imageWidth:0;
    $('imagePlane').style.transform = `translate(${imageX}px, ${imageY}px) scale(${scale}) translate(${offsetX}px, ${offsetY}px) rotate(${quarterTurns*90}deg)`;
    $('zoomValue').textContent = `${Math.round(scale/fitScale*100)}%`;
    $('zoomValue').title = '화면에 맞춘 크기 기준 확대율';
    for (const pin of $('pinLayer').querySelectorAll('.drawing-pin')) pin.style.transform = pinTransform();
  }

  function rotatedSize() { return quarterTurns%2 ? {width:imageHeight,height:imageWidth} : {width:imageWidth,height:imageHeight}; }

  function rotatedPoint(x,y) {
    if(quarterTurns===1)return {x:imageHeight-y,y:x};
    if(quarterTurns===2)return {x:imageWidth-x,y:imageHeight-y};
    if(quarterTurns===3)return {x:y,y:imageWidth-x};
    return {x,y};
  }

  function imageToStagePoint(x,y) {
    const point=rotatedPoint(x*imageWidth,y*imageHeight);
    return {x:imageX+point.x*scale,y:imageY+point.y*scale};
  }

  function stageToImagePoint(stageX,stageY) {
    const x=(stageX-imageX)/scale,y=(stageY-imageY)/scale;
    const point=quarterTurns===1?{x:y,y:imageHeight-x}:quarterTurns===2?{x:imageWidth-x,y:imageHeight-y}:quarterTurns===3?{x:imageWidth-y,y:x}:{x,y};
    return {x:point.x/imageWidth,y:point.y/imageHeight};
  }

  function pinTransform() { return `translate(-50%,-100%) rotate(${-quarterTurns*90}deg) scale(${1/scale})`; }

  function rotateDrawing() {
    if(!current || !imageLoaded)return;
    quarterTurns=(quarterTurns+1)%4;
    memory.set(`rotation.${current.id}`,quarterTurns);
    fitImage();renderPins();updateNavigation();
  }

  function zoomBy(factor,anchorX,anchorY) {
    if (!imageLoaded) return;
    const rect = $('stage').getBoundingClientRect();
    const x = anchorX ?? rect.width/2, y = anchorY ?? rect.height/2;
    const next = Math.min(fitScale*24,Math.max(fitScale*.3,scale*factor));
    imageX = x-(x-imageX)*(next/scale);
    imageY = y-(y-imageY)*(next/scale);
    scale = next; transformImage();
  }

  function setPinMode(enabled) {
    pinMode = !!enabled;
    $('pinBtn').setAttribute('aria-pressed',String(pinMode));
    $('stage').classList.toggle('pinning',pinMode);
    if (enabled) notify('의견을 남길 위치를 도면에서 눌러 주세요.');
  }

  function setDraftPin(pin) {
    pendingPin = pin;
    $('pinDraft').hidden = !pin;
    if (pin) $('pinDraftText').textContent = `${pin.page}쪽 · 선택한 위치에 의견을 남깁니다`;
    renderPins();
    saveCommentDraft();
  }

  function renderPins() {
    if (!current) { $('pinLayer').innerHTML=''; return; }
    const visible = comments.filter((comment)=>Number(comment.page)===pageIndex+1 && Number.isFinite(Number(comment.x)) && comment.x!==null && Number.isFinite(Number(comment.y)) && comment.y!==null && ($('showResolved').checked || !comment.resolved));
    $('pinLayer').innerHTML = (showPins?visible.map((comment)=> {
      const index = comments.findIndex((entry)=>entry.id===comment.id)+1;
      return `<button class="drawing-pin${comment.resolved?' resolved':''}" style="left:${Math.max(0,Math.min(1,Number(comment.x)))*100}%;top:${Math.max(0,Math.min(1,Number(comment.y)))*100}%;transform:${pinTransform()}" data-comment-id="${escape(comment.id)}" title="${escape(comment.author)}: ${escape(comment.text)}" aria-label="의견 ${index}: ${escape(comment.text?.slice(0,80))}"><b>${index}</b></button>`;
    }).join(''):'') + (pendingPin && Number(pendingPin.page)===pageIndex+1 ? `<span class="drawing-pin draft" style="left:${pendingPin.x*100}%;top:${pendingPin.y*100}%;transform:${pinTransform()}"><b>+</b></span>`:'');
  }

  function formatTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value||'');
    return date.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
  }

  function renderComments() {
    $('commentCount').textContent = comments.length;
    const signature = JSON.stringify([current?.id,comments,$('showResolved').checked]);
    if (signature===commentSignature) return;
    commentSignature = signature;
    const visible = comments.filter((comment)=>$('showResolved').checked || !comment.resolved);
    if (!visible.length) {
      $('commentList').innerHTML = `<div class="comments-empty"><svg viewBox="0 0 48 48"><path d="M10 9h28v23H23l-9 7v-7h-4zM17 17h14M17 24h9"/></svg><strong>${comments.length?'열린 논의가 없습니다':'이 도면에서 함께 확인할 점은?'}</strong><p>${comments.length?'완료 포함을 켜면 이전 논의를 볼 수 있어요.':'검토 의견이나 결정 사항을 남겨 보세요.<br>위치를 찍어 더 정확하게 이야기할 수 있어요.'}</p></div>`;
    } else {
      $('commentList').innerHTML = visible.map((comment)=>{
        const hasPin = comment.x!==null && comment.x!==undefined && comment.y!==null && comment.y!==undefined;
        const index = comments.findIndex((entry)=>entry.id===comment.id)+1;
        return `<article class="comment-card${comment.resolved?' resolved':''}" id="comment-${escape(comment.id)}"><div class="comment-meta"><span class="comment-author"><span class="comment-avatar">${escape(String(comment.author||'?').slice(0,1))}</span>${escape(comment.author||'작성자')}</span><time title="${escape(comment.createdAt)}">${escape(formatTime(comment.createdAt))}</time></div><p class="comment-text">${escape(comment.text)}</p><div class="comment-actions"><button class="comment-location" data-goto-comment="${escape(comment.id)}" title="의견이 등록된 페이지와 위치 보기">${hasPin?pinGlyph:''}${hasPin?`위치 ${index} · `:''}${Number(comment.page)||1}쪽</button><button class="resolve-button" data-resolve="${escape(comment.id)}" data-resolved="${comment.resolved?'true':'false'}">${comment.resolved?'다시 열기':'논의 완료 ✓'}</button></div></article>`;
      }).join('');
    }
    renderPins();
  }

  function focusComment(id) {
    const comment = comments.find((entry)=>String(entry.id)===String(id));
    if (!comment) return;
    openInspector();
    if (comment.resolved && !$('showResolved').checked) { $('showResolved').checked = true; renderComments(); }
    const card = document.getElementById(`comment-${id}`);
    if (card) {
      card.scrollIntoView({block:'nearest',behavior:'smooth'});
      card.classList.remove('highlight'); void card.offsetWidth; card.classList.add('highlight');
    }
  }

  function gotoComment(id) {
    const comment = comments.find((entry)=>String(entry.id)===String(id));
    if (!comment) return;
    const nextPage = Math.max(0,Math.min(previewPages().length-1,(Number(comment.page)||1)-1));
    const hasPin=comment.x!==null && comment.x!==undefined && comment.y!==null && comment.y!==undefined;
    if (nextPage!==pageIndex) {
      if (hasPin) deferredCommentFocus={drawingId:current.id,page:nextPage+1,x:Number(comment.x),y:Number(comment.y)};
      pageIndex=nextPage; renderPreview();
    } else if (imageLoaded && hasPin) centerOnPoint(Number(comment.x),Number(comment.y));
    focusComment(id);
  }

  function centerOnPoint(x,y) {
    if (!imageLoaded || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const rect=$('stage').getBoundingClientRect();
    scale=Math.max(scale,fitScale*1.8);
    const point=imageToStagePoint(x,y);
    imageX+=rect.width/2-point.x;
    imageY+=rect.height/2-point.y;
    transformImage();
  }

  function saveCommentDraft() {
    if (!current) return;
    memory.set(`draft.${current.id}`,JSON.stringify({text:$('commentInput').value,pin:pendingPin}));
    draftDirty = false;
  }

  function loadCommentDraft(id) {
    let draft = {};
    try { draft=JSON.parse(memory.get(`draft.${id}`,'{}')); } catch {}
    $('commentInput').value=typeof draft.text==='string'?draft.text:'';
    pendingPin=draft.pin||null;
    $('pinDraft').hidden=!pendingPin;
    if (pendingPin) $('pinDraftText').textContent=`${pendingPin.page}쪽 · 선택한 위치에 의견을 남깁니다`;
    draftDirty=false;
  }

  async function submitComment(event) {
    event?.preventDefault();
    if (!current || !$('commentForm').reportValidity()) return;
    const author=$('authorInput').value.trim(), text=$('commentInput').value.trim(), id=current.id;
    if (!author || !text) { notify('작성자와 의견을 입력해 주세요.'); return; }
    const body={author,text,page:pendingPin?.page||pageIndex+1};
    if (pendingPin) { body.x=pendingPin.x; body.y=pendingPin.y; }
    $('submitComment').disabled=true;
    try {
      const result=await request(`/api/drawings/${encodeURIComponent(id)}/comments`,{method:'POST',body});
      memory.set('author',author);
      memory.set(`draft.${id}`,'{}');
      if (current?.id===id) {
        const comment=result.comment||result;
        comments.push(comment);
        $('commentInput').value=''; setDraftPin(null); renderComments();
        $('commentList').scrollTop=$('commentList').scrollHeight;
      }
      notify('의견을 저장했습니다.');
    } catch(error) { notify(`의견 저장 실패: ${error.message}`,true); }
    finally { $('submitComment').disabled=!current; }
  }

  async function resolveComment(id,resolved) {
    const selectedId=current?.id;
    try {
      const result=await request(`/api/comments/${encodeURIComponent(id)}/resolve`,{method:'POST',body:{resolved}});
      if (current?.id!==selectedId) return;
      const updated=result.comment||result;
      comments=comments.map((comment)=>String(comment.id)===String(id)?updated:comment);
      renderComments(); notify(resolved?'논의를 완료로 표시했습니다.':'논의를 다시 열었습니다.');
    } catch(error) { notify(error.message,true); }
  }

  function moveDrawing(delta) {
    const index=filtered.findIndex((item)=>item.id===current?.id), target=filtered[index+delta];
    if (target) return selectDrawing(target.id);
  }

  function movePage(delta) {
    const pages=previewPages(), next=pageIndex+delta;
    if (next<0 || next>=pages.length) return;
    pageIndex=next; pageByDrawing.set(current.id,pageIndex); setPinMode(false); renderPreview();
  }

  function preloadNext() {
    if (!hostActive || document.hidden) return;
    const index=filtered.findIndex((item)=>item.id===current?.id);
    for (const target of [filtered[index+1],filtered[index-1]]) {
      const page=target?.preview?.pages?.[0];
      if (page) { const image=new Image(); image.src=safeUrl(typeof page==='string'?page:page.src); }
    }
  }

  function openInspector() {
    $('workspace').classList.remove('hide-inspector');
    if (innerWidth<=980) $('workspace').classList.add('show-inspector');
  }

  function toggleInspector() {
    if (innerWidth<=980) $('workspace').classList.toggle('show-inspector');
    else $('workspace').classList.toggle('hide-inspector');
    scheduleFit();
  }

  function toggleLibrary() {
    if (innerWidth<=700) $('workspace').classList.toggle('show-library');
    else $('workspace').classList.toggle('hide-library');
    scheduleFit();
  }

  function meetingMode(force) {
    const enabled=typeof force==='boolean'?force:!$('workspace').classList.contains('meeting');
    $('workspace').classList.toggle('meeting',enabled);
    $('meetingBtn').setAttribute('aria-pressed',String(enabled));
    $('exitMeeting').hidden=!enabled;
    scheduleFit();
  }

  function scheduleFit() { clearTimeout(resizeTimer); resizeTimer=setTimeout(fitImage,210); }

  async function loadCatalog({keepSelection=true}={}) {
    if (isLoadingCatalog) return;
    isLoadingCatalog=true;
    try {
      const data=await request('/api/catalog');
      items=Array.isArray(data.items)?data.items:[];
      sortItems();
      for (const item of items) item._search=[item.name,item.site,item.building,item.category,item.ext,item.sources,item.searchText,item.id].filter(Boolean).join(' ').toLocaleLowerCase('ko');
      states=data.states||{};
      lastCatalogSync=Date.now();
      addSelectOptions('siteFilter',items.map((item)=>item.site),'모든 공장');
      addSelectOptions('categoryFilter',items.map((item)=>item.category),'모든 분류',cleanCategory);
      const initialId=new URL(location.href).searchParams.get('drawing')||memory.get('current');
      const linkedItem=items.find((item)=>item.id===new URL(location.href).searchParams.get('drawing'));
      if (linkedItem && !isReadyDrawing(linkedItem)) scope='all';
      updateGlobalStats(); applyFilters({choose:false});
      const id=keepSelection && current && filtered.some((item)=>item.id===current.id) ? current.id : (filtered.some((item)=>item.id===initialId)?initialId:filtered[0]?.id);
      if (id) await selectDrawing(id); else clearSelection();
      $('accessGate').hidden=true;
      notifyHostReady();
    } finally { isLoadingCatalog=false; }
  }

  async function poll() {
    if (isPolling || !hostActive || document.hidden || !$('accessGate').hidden || isLoadingCatalog) return;
    isPolling=true;
    try {
      const id=current?.id, version=selectionVersion;
      const jobs=[request('/api/progress')];
      if (id) jobs.push(request(`/api/drawings/${encodeURIComponent(id)}`));
      const catalogIndex=jobs.length;
      const syncCatalog=Date.now()-lastCatalogSync>=30000;
      if (syncCatalog) jobs.push(request('/api/catalog'));
      const results=await Promise.allSettled(jobs);
      if (results[0].status==='fulfilled') {
        const progress=results[0].value;
        $('refreshBtn').title=`미리보기 ${progress.ready||0}개 준비 · ${progress.processing||0}개 진행/대기 · ${progress.failed||0}개 실패`;
      }
      if (syncCatalog && results[catalogIndex]?.status==='fulfilled') {
        const data=results[catalogIndex].value;
        const indexed=new Map((data.items||[]).map((item)=>[item.id,item]));
        for (const item of items) { const updated=indexed.get(item.id); if (updated) Object.assign(item,updated); }
        states=data.states||states;
        lastCatalogSync=Date.now();
        updateGlobalStats();
        applyFilters({choose:false});
      }
      if (id && results[1]?.status==='fulfilled' && current?.id===id && selectionVersion===version) {
        const detail=results[1].value;
        if (detail.preview) current.preview=detail.preview;
        current.detailJob=detail.detailJob||null;
        if (detail.state) states[id]=detail.state;
        comments=Array.isArray(detail.comments)?detail.comments:comments;
        renderState(); renderMetadata(); renderComments(); renderPreview(); updateGlobalStats(); renderList();
        const selected=$('drawingList').querySelector('.selected .item-dot');
        if (selected) { selected.className=`item-dot ${stateFor(id).status}`; selected.title=statusNames[stateFor(id).status]||'미검토'; }
      }
    } catch {} finally { isPolling=false; }
  }

  async function copyText(text,button) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const input=document.createElement('textarea'); input.value=text; input.style.position='fixed'; input.style.top='-1000px'; document.body.append(input); input.select();
        const copied=document.execCommand('copy'); input.remove(); if (!copied) throw new Error('복사 실패');
      }
      const original=button.innerHTML; button.textContent='복사됨'; setTimeout(()=>button.innerHTML=original,1800);
    } catch { notify('자동 복사를 사용할 수 없습니다. 주소를 선택해 복사해 주세요.'); }
  }

  async function copyCurrentInfo() {
    if (!current) return;
    const index=filtered.findIndex((item)=>item.id===current.id);
    const text=[`도면: ${current.name}`,`도면 ID: ${current.id.slice(0,8)} (SHA256: ${current.id})`,`현재 목록: ${index+1} / ${filtered.length}`,`페이지: ${previewPages().length ? `${pageIndex+1} / ${previewPages().length}` : '미리보기 없음'}`,`분류: ${[current.site,current.building,cleanCategory(current.category)].filter(Boolean).join(' / ')}`,`사용 후보: ${stateFor(current.id).starred?'선택':'미선택'}`].join('\n');
    await copyText(text,$('copyCurrent'));
  }

  async function exportRecords() {
    $('exportBtn').disabled=true;
    try {
      const blob=await request('/api/export.csv',{asBlob:true});
      const url=URL.createObjectURL(blob), link=document.createElement('a');
      const today=new Date().toLocaleDateString('sv-SE');
      link.href=url; link.download=`도면검토_회의기록_${today}.csv`; document.body.append(link); link.click(); link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000); notify('회의기록 CSV를 저장했습니다.');
    } catch(error) { notify(error.message,true); } finally { $('exportBtn').disabled=false; }
  }

  async function improvePreview() {
    if (!current) return;
    const id = current.id;
    $('detailPreviewBtn').disabled = true;
    try {
      const result = await request(`/api/drawings/${encodeURIComponent(id)}/preview`,{method:'POST',body:{}});
      if (current?.id===id) { current.detailJob=result.detailJob||result; renderMetadata(); }
      notify('상세 미리보기 작업을 요청했습니다. 완료되면 자동으로 표시됩니다.');
    } catch(error) { notify(error.message,true); if(current?.id===id)$('detailPreviewBtn').disabled=false; }
  }

  async function initialize() {
    $('authorInput').value=memory.get('author');
    const access=new URLSearchParams(location.hash.slice(1)).get('access');
    if (access) { token=access; memory.set('token',token); history.replaceState(null,'',location.pathname+location.search); }
    try {
      const bootstrap=await fetch(safeUrl('/api/bootstrap'),{credentials:'same-origin',cache:'no-store'}).then((response)=>response.json());
      if (bootstrap.token) { token=bootstrap.token; memory.set('token',token); }
      if (!token) { $('accessGate').hidden=false; $('accessCode').focus(); return; }
      await loadCatalog();
    } catch(error) { notify(`앱을 열지 못했습니다: ${error.message}`,true); showStageMessage('자료를 불러오지 못했습니다','앱 실행 상태를 확인하고 목록의 새로 고침 버튼을 눌러 주세요.'); }
  }

  $('drawingList').addEventListener('click',(event)=>{
    const item=event.target.closest('[data-id]'); if (!item) return;
    selectDrawing(item.dataset.id);
    if (innerWidth<=700) $('workspace').classList.remove('show-library');
  });
  $('scopeOptions').addEventListener('click',(event)=>{const button=event.target.closest('[data-scope]');if(!button)return;scope=button.dataset.scope;applyFilters();});
  $('overviewGrid').addEventListener('click',(event)=>{const card=event.target.closest('[data-overview-id]');if(!card)return;$('overviewDialog').close();selectDrawing(card.dataset.overviewId);$('stage').focus({preventScroll:true});});
  document.addEventListener('error',(event)=>{if(event.target instanceof HTMLImageElement && event.target.closest('.drawing-thumb'))event.target.remove();},true);
  $('search').addEventListener('input',()=>{clearTimeout(filterTimer);filterTimer=setTimeout(()=>applyFilters(),130);});
  for (const id of ['siteFilter','categoryFilter','statusFilter']) $(id).addEventListener('change',()=>applyFilters());
  $('starFilter').addEventListener('click',()=>{onlyStars=!onlyStars;$('starFilter').setAttribute('aria-pressed',String(onlyStars));$('starFilter').querySelector('span').textContent=onlyStars?'★':'☆';applyFilters();});
  $('resetFilters').addEventListener('click',()=>{scope='ready';$('search').value='';$('siteFilter').value='';$('categoryFilter').value='';$('statusFilter').value='';onlyStars=false;$('starFilter').setAttribute('aria-pressed','false');$('starFilter').querySelector('span').textContent='☆';applyFilters();});
  $('refreshBtn').addEventListener('click',()=>loadCatalog().then(()=>notify('자료 목록을 새로 불러왔습니다.')).catch((error)=>notify(error.message,true)));
  $('prevDrawing').addEventListener('click',()=>moveDrawing(-1));$('nextDrawing').addEventListener('click',()=>moveDrawing(1));
  $('prevPage').addEventListener('click',()=>movePage(-1));$('nextPage').addEventListener('click',()=>movePage(1));
  $('fitBtn').addEventListener('click',fitImage);$('zoomValue').addEventListener('click',fitImage);
  $('rotateBtn').addEventListener('click',rotateDrawing);$('zoomIn').addEventListener('click',()=>zoomBy(1.3));$('zoomOut').addEventListener('click',()=>zoomBy(1/1.3));
  $('starCurrent').addEventListener('click',()=>current&&updateState({starred:!stateFor(current.id).starred}));
  $('statusOptions').addEventListener('click',(event)=>{const button=event.target.closest('[data-status]');if(button) updateState({status:button.dataset.status});});
  $('pinBtn').addEventListener('click',()=>{if(imageLoaded)setPinMode(!pinMode);});
  $('showPinsBtn').addEventListener('click',()=>{showPins=!showPins;$('showPinsBtn').setAttribute('aria-pressed',String(showPins));renderPins();});
  $('clearPin').addEventListener('click',()=>setDraftPin(null));
  $('showResolved').addEventListener('change',renderComments);
  $('commentForm').addEventListener('submit',submitComment);
  $('commentInput').addEventListener('input',()=>{draftDirty=true;saveCommentDraft();});
  $('authorInput').addEventListener('change',()=>memory.set('author',$('authorInput').value));
  $('commentInput').addEventListener('keydown',(event)=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();submitComment();}});
  $('commentList').addEventListener('click',(event)=>{const location=event.target.closest('[data-goto-comment]'),resolve=event.target.closest('[data-resolve]');if(location)gotoComment(location.dataset.gotoComment);if(resolve)resolveComment(resolve.dataset.resolve,resolve.dataset.resolved!=='true');});
  $('pinLayer').addEventListener('click',(event)=>{const pin=event.target.closest('[data-comment-id]');if(pin){event.stopPropagation();focusComment(pin.dataset.commentId);}});
  $('pinLayer').addEventListener('pointerdown',(event)=>{if(event.target.closest('[data-comment-id]'))event.stopPropagation();});
  $('toggleLibrary').addEventListener('click',toggleLibrary);$('closeLibrary').addEventListener('click',()=>{$('workspace').classList.remove('show-library');$('workspace').classList.add('hide-library');scheduleFit();});
  $('toggleInspector').addEventListener('click',toggleInspector);$('closeInspector').addEventListener('click',()=>{$('workspace').classList.remove('show-inspector');$('workspace').classList.add('hide-inspector');scheduleFit();});
  $('meetingBtn').addEventListener('click',()=>meetingMode());$('exitMeeting').addEventListener('click',()=>meetingMode(false));
  $('dismissNotice').addEventListener('click',()=>{noticeDismissedFor=current?.id;$('previewNotice').hidden=true;scheduleFit();});
  $('detailPreviewBtn').addEventListener('click',improvePreview);
  $('overviewBtn').addEventListener('click',()=>{renderOverview();$('overviewDialog').showModal();});$('copyCurrent').addEventListener('click',copyCurrentInfo);$('exportBtn').addEventListener('click',exportRecords);
  $('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());
  document.querySelectorAll('.dialog-close').forEach((button)=>button.addEventListener('click',()=>button.closest('dialog').close()));
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',(event)=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  $('accessForm').addEventListener('submit',async(event)=>{event.preventDefault();const value=$('accessCode').value.trim();if(!value)return;token=value;try{await loadCatalog();memory.set('token',token);$('accessGate').hidden=true;$('accessError').textContent='';}catch(error){$('accessError').textContent=error.message;}});

  $('stage').addEventListener('wheel',(event)=>{
    if(!imageLoaded)return; event.preventDefault();const rect=$('stage').getBoundingClientRect();zoomBy(Math.exp(-Math.max(-120,Math.min(120,event.deltaY))*.0025),event.clientX-rect.left,event.clientY-rect.top);
  },{passive:false});
  $('stage').addEventListener('pointerdown',(event)=>{
    if(!imageLoaded||event.button!==0||event.target.closest('button'))return;
    if(pinMode){const rect=$('stage').getBoundingClientRect(),{x,y}=stageToImagePoint(event.clientX-rect.left,event.clientY-rect.top);if(x>=0&&x<=1&&y>=0&&y<=1){setDraftPin({x,y,page:pageIndex+1});setPinMode(false);openInspector();$('commentInput').focus();}else notify('도면 안쪽의 위치를 선택해 주세요.');return;}
    drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,initialX:imageX,initialY:imageY};$('stage').setPointerCapture(event.pointerId);event.preventDefault();
  });
  $('stage').addEventListener('pointermove',(event)=>{if(!drag||drag.pointer!==event.pointerId)return;imageX=drag.initialX+event.clientX-drag.x;imageY=drag.initialY+event.clientY-drag.y;transformImage();});
  const endDrag=(event)=>{if(drag&&drag.pointer===event.pointerId){drag=null;try{$('stage').releasePointerCapture(event.pointerId);}catch{}}};
  $('stage').addEventListener('pointerup',endDrag);$('stage').addEventListener('pointercancel',endDrag);
  $('stage').addEventListener('dblclick',(event)=>{if(event.target.closest('button'))return;fitImage();});
  document.addEventListener('keydown',(event)=>{
    if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||document.querySelector('dialog[open]')||!$('accessGate').hidden)return;
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable)return;
    const key=event.key.toLowerCase();
    if(key==='arrowleft'){event.preventDefault();moveDrawing(-1);}else if(key==='arrowright'){event.preventDefault();moveDrawing(1);}else if(key==='pageup'){event.preventDefault();movePage(-1);}else if(key==='pagedown'){event.preventDefault();movePage(1);}else if(key==='+'||key==='='){event.preventDefault();zoomBy(1.3);}else if(key==='-'){event.preventDefault();zoomBy(1/1.3);}else if(key==='0'){event.preventDefault();fitImage();}else if(key==='r'){event.preventDefault();rotateDrawing();}else if(key==='f'){event.preventDefault();meetingMode();}else if(key==='/'){event.preventDefault();$('workspace').classList.remove('hide-library');if(innerWidth<=700)$('workspace').classList.add('show-library');$('search').focus();}else if(key==='escape'){setPinMode(false);meetingMode(false);$('workspace').classList.remove('show-library','show-inspector');}
  });
  window.addEventListener('message',(event)=>{
    if (event.source!==window.parent || event.origin!==location.origin || event.data?.type!=='dryer-workspace:visibility' || typeof event.data.active!=='boolean') return;
    hostActive=event.data.active;
    if(hostActive){scheduleFit();poll();}else{saveCommentDraft();drag=null;}
  });
  window.addEventListener('resize',scheduleFit);
  if(window.ResizeObserver)new ResizeObserver(scheduleFit).observe($('stage'));
  window.addEventListener('beforeunload',()=>{if(draftDirty)saveCommentDraft();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  setInterval(poll,5000);
  initialize();
})();
