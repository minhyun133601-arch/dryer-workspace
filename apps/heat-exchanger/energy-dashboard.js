(() => {
  'use strict';
  const data = window.HeatEnergyData;
  const model = window.HeatEnergyModel;
  const root = document.getElementById('energy-dashboard');
  if (!root || !data || !model) return;
  const $ = (id) => document.getElementById(id);
  const n = (value, digits = 0) => Number.isFinite(value) ? value.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
  const won = (value) => n(value / 100000000, 2) + '억원';
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = (id) => { const raw = $(id)?.value.trim(); return raw === '' || raw == null ? null : Number(raw); };
  const targetId = data.source.equipmentTeamId;
  root.innerHTML = `
    <div class="energy-heading">
      <div><p class="energy-eyebrow">2026 ACTUALS / 2027 OUTLOOK</p><h2 id="energy-title">열교환기 도입, 올해와 내년을 비교하면</h2><p>유산 생산1팀 2파트 적용 · 엑셀 실적과 기안의 절감 효과를 연결한 2027년 예상안</p></div>
      <div class="energy-heading-actions"><button type="button" id="energy-present" aria-pressed="false">비교 발표 모드</button><button type="button" id="energy-show-evidence">산정 근거</button></div>
    </div>
    <div class="energy-timeline" aria-label="보고서의 도입 일정과 예측 기간">
      <div><small>01 · 확인된 절차</small><strong>2026.02.12 기안 승인</strong><span>기안 01.21 · 장비·설치 선정 7억원</span></div>
      <div><small>02 · 보고서 공사 계획</small><strong>10.01 → 11.10, 41일</strong><span>완료·성능검수 실적은 확보자료에서 미확인</span></div>
      <div><small>03 · 올해 비교 기준</small><strong>2026년 1~9월 실적</strong><span>누락 없는 기간을 12개월로 환산</span></div>
      <div class="future"><small>04 · 내년 도입 예상안</small><strong>2027년 정상 가동</strong><span>24시간 × 300일 · 생산량·단가 유지</span></div>
    </div>
    <div class="energy-scenario" aria-label="2027년 예상안 가정 조정">
      <strong>2027년 예상안 조정</strong>
      <label for="energy-realization">예상 효과 반영<input id="energy-realization" type="range" min="0" max="100" step="5" value="100"><output id="energy-realization-value" for="energy-realization">100%</output></label>
      <label for="energy-growth">생산량 증감<input id="energy-growth" type="number" min="-50" max="100" step="1" value="0">%</label>
      <label for="energy-start">가동 시작<select id="energy-start"><option value="1">1월 · 연간</option><option value="4">4월부터</option><option value="7">7월부터</option><option value="10">10월부터</option></select></label>
      <button id="energy-reset" type="button" class="energy-source-button">보고서 기준</button>
    </div>
    <p class="energy-error" id="energy-error" role="alert" hidden></p>
    <div class="energy-metrics" id="energy-metrics" aria-live="polite"></div>
    <p class="energy-assumption" id="energy-assumption"></p>
    <div class="energy-grid">
      <article class="energy-panel"><div class="energy-panel-head"><div><h3>자료 전체 에너지비, 얼마나 달라질까</h3><p>전기·LNG·LPG 합계 · 건조기 전용 비용 아님</p></div><span class="energy-panel-unit">연간 / 억원</span></div><div class="energy-legend"><span><i></i>전기</span><span><i class="lng"></i>LNG</span><span><i class="lpg"></i>LPG</span></div><div id="energy-cost-chart"></div><p class="energy-cost-delta good" id="energy-cost-delta"></p></article>
      <article class="energy-panel"><div class="energy-panel-head"><div><h3>팀별 kJ/kg, 도입 효과를 겹쳐보면</h3><p>2025 연간 · 2026 1~9월 · 2027 도입 후 참고안</p></div><span class="energy-panel-unit">kJ/kg</span></div><div class="energy-legend"><span><i style="background:#c78d69"></i>2025 연간</span><span><i class="before"></i>2026 실적</span><span><i class="after"></i>2027 도입 예상</span></div><div id="energy-team-chart"></div><p class="energy-team-note">열교환기 효과는 설치도에 명시된 1팀 2파트에만 배분했습니다. 팀별 수치는 건조기를 포함한 팀 전체 총열량 기준입니다.</p></article>
    </div>
    <article class="energy-panel" style="margin-bottom:18px"><div class="energy-panel-head"><div><h3>올해 실적에서 내년 예상까지</h3><p>생산량·열량·비용을 같은 표에서 확인하세요.</p></div><span class="energy-panel-unit">예상안은 실적과 구분</span></div><div class="energy-table-wrap" id="energy-outlook-table"></div><p class="energy-period-note">2026 연말 예상은 1~9월 × 12/9의 단순 연환산입니다. 계절·제품 구성·생산 계획 변화는 미반영이며, 올해 열교환기 절감액은 완료 실적이 없어 반영하지 않았습니다.</p></article>
    <div class="energy-grid">
      <article class="energy-panel"><div class="energy-panel-head"><div><h3>전년 대비, 동일한 1~9월 비용</h3><p>엑셀 ‘전년 대비 비교’의 같은 기간 비교</p></div><span class="energy-panel-unit">억원</span></div><div class="energy-table-wrap" id="energy-yoy-table"></div></article>
      <article class="energy-panel energy-monthly"><div class="energy-panel-head"><div><h3>월별 비용, 증가한 달을 확인하세요</h3><p>2025년과 2026년 1~9월 · 전기·LNG·LPG 합계</p></div><span class="energy-panel-unit">억원</span></div><div class="energy-legend"><span><i style="background:#c6d4dc"></i>2025</span><span><i style="background:#438a9c"></i>2026</span></div><div id="energy-month-chart"></div></article>
    </div>
    <details class="energy-evidence" id="energy-evidence"><summary>원자료와 예상안 산식 · 보고서 7개와 엑셀 전체 시트 검토</summary><div class="energy-evidence-content">
      <h4>2024~2026년 원자료 집계</h4><div class="energy-table-wrap" id="energy-history-table" style="margin-bottom:22px"></div>
      <div class="energy-evidence-grid"><div><h4>확인한 실적과 적용 범위</h4><ul><li>주 엑셀 4개 시트와 36개월 원자료를 모두 확인했습니다. 비용은 2025/2026년 1~9월끼리 비교합니다.</li><li>팀별 kJ/kg은 2025년 연간과 2026년 1~9월 기준입니다. 팀별 월별 열량·생산량이 없어 동일 기간 원단위로 재구성하지 않았습니다.</li><li>2026년 10~12월은 일부 사용량·비용이 누락 또는 0으로 기록돼 연환산 기준에서 제외했습니다.</li><li>열교환기 대상은 설치도 2쪽의 ‘유산) 생산1팀2파트 건조기 가스(LPG/LNG) 절감’입니다.</li></ul></div><div><h4>2027년 예상안의 계산 기준</h4><ul><li>생산량·기존 원단위·단가는 2026년 1~9월 수준을 유지합니다. 생산량 증감 시 기존 사용열량과 비용도 같은 비율로 변한다고 가정합니다.</li><li>열량 참고안 = 기준 사용열량 − 회수열 kW × 3,600 × 연 가동시간 × 효과 반영률. 회수열이 KPI 열량을 1:1 대체한다고 가정한 수치입니다.</li><li>가스비 절감 = 기안 보정 가스량 m³/h × 1,800원/m³ × 연 가동시간 × 효과 반영률. 상단 조건 변경과 연동됩니다.</li><li>원자료에 연료별 발열량·버너 효율이 없어 kJ/kg은 확정 목표가 아닌 회수열 기준 참고안입니다. 비용은 별도의 기안 가스 환산량을 사용합니다.</li></ul></div>
      <div><h4>투자·일정·성능 조건</h4><ul><li>기안 5항: 장비·설치 7억원 + 구조진단 400만원 + 지붕 2,000만원 = 예상 투자 7.24억원.</li><li>기안 6항: 2026.10.01~11.10, 41일 계획. 02.12는 기안 승인일이며 공사 완료일이 아닙니다.</li><li>기안 기준 급기 20→59℃·가스 절감 21.45m³/h. 견적은 20→62℃, 열계산 XLS는 20→65℃로 조건이 달라 구분했습니다.</li><li>기존 220kW와 신규 200kW는 정격입니다. 차이 20kW를 실측 전력 절감으로 반영하지 않았습니다.</li></ul></div><div><h4>엑셀에서 확인할 위치</h4><p><code>전년 대비 비교!C11:D15</code> 비용 / <code>C19:D27</code> 월별 비용 / <code>C32:D36</code> 원단위.<br><code>팀별 원단위!D15:F18</code> 2026년 4개 팀 열량·생산량·원단위.<br><code>사업별대조!Q56</code> 부대비 포함 투자 7.24억원.</p><p style="margin-top:9px">관련 금액총괄 8개 시트, KPI 근거산정 6개, 정량보강 2개, 제작스케줄 및 온도 산출 자료도 확인했습니다. 다른 설비인 압축공기 드라이어의 절감액은 합산하지 않았습니다.</p><button class="energy-source-button" id="energy-originals" type="button" style="margin-top:12px">열교환기 도면·원문 7개 열기 ↗</button></div></div>
      <div class="energy-source-list" id="energy-source-sheets"></div>
    </div></details>
    <div class="energy-bottom"><span>검토 기준 2026.11.04 · 실적 마감 2026.09 · 보고서의 정상 가동 효과를 가정한 예상안</span><span id="energy-source-label"></span></div>`;

  function getInputs() {
    const heat = window.heatSimulatorState || {};
    return {
      heatKw: heat.Q, gasM3PerHour: heat.gas, gasPrice: read('gas-price'),
      days: read('days'), hours: read('hours'),
      productionGrowth: read('energy-growth') === null ? NaN : read('energy-growth') / 100,
      realization: read('energy-realization') === null ? NaN : read('energy-realization') / 100,
      startMonth: read('energy-start'), targetTeamId: targetId,
      deltaKw: read('delta-kw'), electricityPrice: read('electricity-price'), maintenanceWon: read('maintenance') * 10000,
    };
  }
  const metric = (label, value, unit, before, change, primary = false) => `<article class="energy-metric${primary ? ' primary' : ''}"><span class="metric-label">${label}</span><strong class="metric-value">${value}<em>${unit}</em></strong><span class="metric-before">${before}</span><span class="metric-change">${change}</span></article>`;

  function renderCostChart(forecast) {
    const b = forecast.base, p = forecast.projected;
    const max = Math.max(forecast.current.totalCostWon, b.totalCostWon, p.totalCostWon) * 1.04;
    const before = [b.electricityCostWon, b.lngCostWon, b.lpgCostWon];
    // Source has no LNG/LPG assignment for this burner: keep the fuel mix and
    // present the remaining gas cost as one undivided segment after installation.
    const rows = [
      ['2026 연말', '1~9월 연환산', forecast.current, [forecast.current.electricityCostWon, forecast.current.lngCostWon, forecast.current.lpgCostWon]],
      ['2027 미도입', '동일 원단위 가정', b, before],
      ['2027 도입', '가스비 절감 반영', p, [b.electricityCostWon, Math.max(0, b.gasCostWon - forecast.saving.gasCostWonApplied), 0]],
    ];
    $('energy-cost-chart').innerHTML = rows.map(([label, note, item, parts]) => `<div class="energy-cost-row"><span class="row-label">${label}<small>${note}</small></span><div class="energy-cost-track" role="img" aria-label="${label} ${won(item.totalCostWon)}"><i style="width:${parts[0] / max * 100}%"></i><i class="lng" style="width:${parts[1] / max * 100}%" title="${label === '2027 도입' ? '가스 합계 잔액: LNG/LPG 배분 미확인' : 'LNG'}"></i><i class="lpg" style="width:${parts[2] / max * 100}%"></i></div><strong>${n(item.totalCostWon / 1e8, 2)}</strong></div>`).join('');
    $('energy-cost-delta').innerHTML = `연 가스비 <b>${won(forecast.saving.gasCostWonApplied)}</b> 감소 · 자료 전체 비용의 <b>${n(forecast.saving.gasCostWonApplied / b.totalCostWon * 100, 1)}%</b><br>도입 후 막대의 가스비는 합계로 표시합니다. LNG·LPG별 절감 배분은 미확인입니다.`;
  }

  function renderTeams(forecast) {
    const prior = data.annual['2025'].teams;
    const actual = data.annual['2026'].teams;
    const max = Math.ceil(Math.max(...prior.map((t) => t.kjPerKg), ...actual.map((t) => t.kjPerKg), ...forecast.teamForecasts.map((t) => t.projectedKjPerKg)) / 1000) * 1000;
    const all = { id: 'all', name: '전체 · 가중 원단위', projectedKjPerKg: forecast.projected.kjPerKg };
    $('energy-team-chart').innerHTML = [...forecast.teamForecasts, all].map((team) => {
      const prev = team.id === 'all' ? data.annual['2025'] : prior.find((t) => t.id === team.id);
      const current = team.id === 'all' ? data.annual['2026'] : actual.find((t) => t.id === team.id);
      const target = team.id === targetId || team.id === 'all';
      return `<div class="energy-team-row"><div class="energy-team-label"><strong>${esc(team.name)}${team.id === targetId ? '<span class="energy-scope-tag">열교환기 적용</span>' : ''}</strong><span>${n(current.kjPerKg)} → <b>${n(team.projectedKjPerKg)}</b></span></div><div class="energy-team-track" role="img" aria-label="${esc(team.name)} 2025년 ${n(prev.kjPerKg)}, 2026년 ${n(current.kjPerKg)}, 2027년 ${n(team.projectedKjPerKg)} kJ/kg"><i class="team-base" style="width:${current.kjPerKg / max * 100}%"></i>${target ? `<i class="team-after" style="width:${team.projectedKjPerKg / max * 100}%"></i>` : ''}<i class="team-prior" style="left:${prev.kjPerKg / max * 100}%"></i></div></div>`;
    }).join('') + `<div class="energy-team-axis"><span>0</span><span>${n(max / 2)}</span><span>${n(max)} kJ/kg</span></div>`;
  }

  function renderOutlook(f) {
    const target = f.teamForecasts.find((t) => t.id === targetId);
    const actualTarget = data.annual['2026'].teams.find((t) => t.id === targetId);
    const rows = [
      ['생산량 · 자료 전체', n(f.actual.productionKg) + ' kg', n(f.current.productionKg) + ' kg', n(f.base.productionKg) + ' kg', n(f.projected.productionKg) + ' kg'],
      ['원단위 · 1팀 2파트', n(actualTarget.kjPerKg, 1), n(actualTarget.kjPerKg, 1), n(target.baseKjPerKg, 1), n(target.projectedKjPerKg, 1)],
      ['원단위 · 자료 전체', n(f.actual.kjPerKg, 1), n(f.current.kjPerKg, 1), n(f.base.kjPerKg, 1), n(f.projected.kjPerKg, 1)],
      ['전기비', won(f.actual.electricityCostWon), won(f.current.electricityCostWon), won(f.base.electricityCostWon), won(f.base.electricityCostWon)],
      ['가스비 · LNG+LPG', won(f.actual.gasCostWon), won(f.current.gasCostWon), won(f.base.gasCostWon), won(f.base.gasCostWon - f.saving.gasCostWonApplied)],
      ['총 에너지비', won(f.actual.totalCostWon), won(f.current.totalCostWon), won(f.base.totalCostWon), won(f.projected.totalCostWon), 'subtotal'],
      ['에너지비 / 생산량', n(f.actual.costPerKg, 2) + ' 원/kg', n(f.current.costPerKg, 2) + ' 원/kg', n(f.base.costPerKg, 2) + ' 원/kg', n(f.projected.costPerKg, 2) + ' 원/kg'],
      ['가스비 절감액', '미반영', '미반영', '—', won(f.saving.gasCostWonApplied)],
    ];
    if (f.projected.netCostWon !== null) rows.push(['운영비 반영 총비용', '—', '—', won(f.base.totalCostWon), won(f.projected.netCostWon), 'subtotal']);
    $('energy-outlook-table').innerHTML = `<table class="energy-table"><thead><tr><th scope="col">지표</th><th scope="col">2026 실적<span>1~9월 · 9개월</span></th><th scope="col">2026 연말 예상<span>12/9 단순 연환산</span></th><th scope="col">2027 미도입<span>생산·기존 원단위 유지</span></th><th scope="col" class="forecast">2027 도입 예상<span>kJ/kg은 회수열 기준 참고안</span></th></tr></thead><tbody>${rows.map(([label, ...cells]) => { const cls = cells.length === 5 ? cells.pop() : ''; return `<tr class="${cls}"><th scope="row">${label}</th>${cells.map((cell, i) => `<td${i === 3 ? ' class="forecast"' : ''}>${cell}</td>`).join('')}</tr>`; }).join('')}</tbody></table>`;
  }

  function renderHistory() {
    const { cost2025: a, cost2026: b } = data.comparison;
    const rows = [['전기', 'electricityCost'], ['LNG', 'lngCost'], ['LPG', 'lpgCost'], ['가스 소계', 'gasCost'], ['합계', 'totalCost']];
    // The source comparison stores the gas subtotal separately from its total.
    const costs = [a, b].map((row) => ({ ...row, gasCost: row.lngCost + row.lpgCost }));
    $('energy-yoy-table').innerHTML = `<table class="energy-table"><thead><tr><th>비용</th><th>2025<span>1~9월</span></th><th>2026<span>1~9월</span></th><th>증감</th></tr></thead><tbody>${rows.map(([label, key]) => `<tr${key === 'totalCost' ? ' class="subtotal"' : ''}><th scope="row">${label}</th><td>${n(costs[0][key] / 1e8, 2)}</td><td>${n(costs[1][key] / 1e8, 2)}</td><td>${costs[1][key] >= costs[0][key] ? '+' : '−'}${n(Math.abs((costs[1][key] - costs[0][key]) / costs[0][key] * 100), 1)}%</td></tr>`).join('')}</tbody></table>`;
    const raw = data.monthly;
    const values = [2025, 2026].flatMap((year) => raw.filter((m) => m.year === year && m.month <= 9).map((m) => m.totalCost / 1e8));
    const max = Math.ceil(Math.max(...values));
    const W = 610, H = 210, left = 35, bottom = 26, top = 12, plotH = H - bottom - top, plotW = W - left - 12, step = plotW / 9;
    let svg = `<svg class="energy-month-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="2025년과 2026년 1월부터 9월까지 월별 총 에너지비 비교">`;
    for (let v = 0; v <= max; v += 1) { const y = top + plotH * (1 - v / max); svg += `<line class="grid-line" x1="${left}" x2="${W - 12}" y1="${y}" y2="${y}"/><text x="${left - 8}" y="${y + 3}" text-anchor="end">${v}</text>`; }
    for (let month = 1; month <= 9; month++) {
      for (const [idx, year] of [2025, 2026].entries()) {
        const row = raw.find((m) => m.year === year && m.month === month);
        const value = row.totalCost / 1e8, x = left + (month - 1) * step + step * .16 + idx * step * .32, height = value / max * plotH;
        svg += `<rect class="${idx ? 'bar-current' : 'bar-prior'}" x="${x}" y="${top + plotH - height}" width="${step * .28}" height="${height}" rx="2"><title>${year}년 ${month}월 ${won(row.totalCost)}</title></rect>`;
      }
      svg += `<text x="${left + (month - .5) * step}" y="${H - 6}" text-anchor="middle">${month}월</text>`;
    }
    $('energy-month-chart').innerHTML = svg + '</svg>';
    $('energy-source-sheets').innerHTML = data.source.sheets.map((s) => `<span>${esc(s.name)} · ${n(s.nonEmptyCells)}셀 확인</span>`).join('');
    $('energy-source-label').textContent = data.source.filename;
    $('energy-history-table').innerHTML = `<table class="energy-table"><thead><tr><th>실적</th><th>생산량 · kg</th><th>총열량 · GJ</th><th>가중 kJ/kg</th><th>총 에너지비</th></tr></thead><tbody>${Object.entries(data.annual).map(([year, row]) => `<tr><th scope="row">${year}년 1~${row.months}월</th><td>${n(row.productionKg)}</td><td>${n(row.energyKj / 1e6)}</td><td>${n(row.kjPerKg, 1)}</td><td>${won(row.totalCost)}</td></tr>`).join('')}</tbody></table>`;
  }

  function render() {
    $('energy-realization-value').textContent = $('energy-realization').value + '%';
    const f = model.calculateForecast(data, getInputs());
    window.heatEnergyForecast = f;
    const invalid = !f.valid || !$('input-error').hidden;
    $('energy-error').hidden = !invalid;
    if (invalid) {
      $('energy-error').textContent = f.errors?.join(' ') || '상단 운전 조건의 입력 범위를 확인해 주세요.';
      ['energy-metrics', 'energy-cost-chart', 'energy-team-chart', 'energy-outlook-table'].forEach((id) => { $(id).textContent = '입력 확인 후 다시 계산됩니다.'; });
      $('energy-assumption').textContent = ''; $('energy-cost-delta').hidden = true; return;
    }
    $('energy-cost-delta').hidden = false;
    const team = f.teamForecasts.find((t) => t.id === targetId);
    const saving = f.saving.gasCostWonApplied;
    const capex = read('capex') * 10000;
    const payback = saving > 0 ? capex / saving : null;
    $('energy-metrics').innerHTML =
      metric('2027 예상 · 1팀 2파트 원단위', n(team.projectedKjPerKg), 'kJ/kg', `미도입 ${n(team.baseKjPerKg)} kJ/kg`, `${n(team.baseKjPerKg - team.projectedKjPerKg)} kJ/kg 감소 · 회수열 기준 참고안`, true) +
      metric('2027 예상 · 자료 전체 에너지비', n(f.projected.totalCostWon / 1e8, 2), '억원/년', `미도입 ${won(f.base.totalCostWon)}`, `${n(f.projected.costPerKg, 2)} 원/kg · 가스비 절감 반영`) +
      metric('열교환기 연 가스비 절감', n(saving / 1e8, 2), '억원/년', `${n(f.saving.gasM3)} m³/년 · ${n(read('gas-price'))} 원/m³`, `${n(f.saving.operatingHours)}시간 가동 · 전력·정비비 차감 전`) +
      metric('예상 투자 회수', payback === null ? '—' : n(payback, 2), '년', `적용 투자 ${won(capex)}`, f.saving.netSavingWon === null ? '가스비 기준 단순회수' : `운영비 반영 순절감 ${won(f.saving.netSavingWon)}/년`);
    $('energy-assumption').innerHTML = `<b>원단위는 회수열 1:1 대체 참고안입니다.</b> 연료별 발열량·버너 효율이 없어 확정 KPI로 볼 수 없습니다. 생산량 ${n(f.projected.productionKg)}kg, ${n(f.saving.operatingHours)}시간, 효과 ${n(getInputs().realization * 100)}% 반영. ${f.energyBasis === 'net-with-power' ? '입력한 순증전력 열량 반영.' : '순증전력 미확인으로 전력 증감은 미반영.'} 비용은 기안 가스량 보정식 기준이며, 총 에너지비는 건조기 전용이 아닌 자료 전체 범위입니다.${f.capped?.heat || f.capped?.cost ? ' 입력 효과가 기준 사용량을 초과해 감소액을 기준 사용량 이내로 제한했습니다.' : ''}`;
    renderCostChart(f); renderTeams(f); renderOutlook(f);
  }
  renderHistory(); render();
  document.addEventListener('input', (event) => {
    if (event.target.matches('#energy-growth,#energy-realization,#tin-number,#tin-range,#hot-number,#hot-range,#epsilon-number,#epsilon-range,#days,#hours,#gas-price,#cold-flow,#hot-flow,#capex,#delta-kw,#electricity-price,#maintenance')) render();
  });
  $('energy-start').addEventListener('change', render);
  $('reset').addEventListener('click', render);
  $('energy-reset').addEventListener('click', () => { $('energy-growth').value = 0; $('energy-realization').value = 100; $('energy-start').value = 1; $('reset').click(); });
  $('energy-present').addEventListener('click', () => { const active = root.classList.toggle('energy-presentation'); $('energy-present').setAttribute('aria-pressed', String(active)); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('energy-show-evidence').addEventListener('click', () => { $('energy-evidence').open = true; $('energy-evidence').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('energy-originals').addEventListener('click', () => $('evidence-open').click());
  const jump = document.createElement('button'); jump.type = 'button'; jump.textContent = '올해·내년 예상 ↓'; jump.addEventListener('click', () => root.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  document.querySelector('.head-actions').prepend(jump);
  try {
    const url = new URL(window.parent !== window ? window.parent.location.href : location.href);
    const section = url.searchParams.get('section') || new URLSearchParams(url.hash.split('?')[1] || '').get('section');
    if (section === 'forecast') {
      // Navigation may reset scrolling after the first animation frame. Wait for
      // this viewer's load before opening the presentation's comparison area.
      const showForecast = () => requestAnimationFrame(() => root.scrollIntoView({ block: 'start' }));
      if (document.readyState === 'complete') showForecast();
      else window.addEventListener('load', showForecast, { once: true });
    }
  } catch { /* Independently runnable when embedded by another origin. */ }
})();
