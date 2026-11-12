import json
from pathlib import Path
P=Path(__file__).parent
load=lambda n:json.loads((P/n).read_text(encoding='utf-8'))
d=load('content.json'); early=load('reports_early.json')['reports']; late=load('reports_late.json'); inv=load('investment_plan.json')
reports=[]
for r in early:
    extra=r.get('extra',{})
    reports.append({'date':r['date'],'id':r['doc_id'],'title':r['title'],'cost':r['cost_krw'],'vat':r['vat'],'problem':r['issue'],'action':r['action'],'effect':r['financial_effect'],'mapping':r['mapping_2027'],'caution':r['caution'],'folder':r['folder'],'locator':'본문 및 첨부파일; '+extra.get('attachment_source',''),'classification':'2026 보고','quote':extra.get('quote_krw',extra.get('selected_quote_krw')),'nego':extra.get('nego_krw',extra.get('negotiated_krw')),'oneoff':extra.get('quote_reduction_krw'),'scrap':extra.get('scrap_receipt_krw'),'conflict':extra.get('conflict','')})
for r in late:
    cv=lambda x:round(x*1e6) if x is not None else None
    reports.append({'date':r['date'],'id':r['id'],'title':r['title'],'cost':cv(r['cost_million_krw_ex_vat']),'vat':'별도','problem':r['problem'],'action':r['action'],'effect':r['summary']+' '+r['result'],'mapping':r['investment_2027_ids']+' '+r['connection'],'caution':r['caution'],'folder':r['folder'],'locator':'본문 및 첨부파일','classification':'2025 시공·2026 보고' if r['id']=='공무환경팀-202607-보고서-2' else '2026 보고','quote':cv(r['quote_million_krw_ex_vat']),'nego':cv(r['cost_million_krw_ex_vat']) if r['quote_million_krw_ex_vat'] else None,'oneoff':cv(r['one_off_quote_reduction_million_krw']),'scrap':None,'conflict':''})
p=inv['prior_example']
reports.append({'date':p['date'],'id':p['report_id'],'title':p['title'],'cost':None,'vat':'별도 기준; 견적 대조필요','problem':p['issue'],'action':'V-MIXER2기 매각, 철거·운송 매수인 부담','effect':'고철처리안 순지출2,675,000원 대비 매각수입4,000,000원. 대안대비 현금개선6,675,000원(일회성).','mapping':p['application_2027'],'caution':'2025 기안·2026 승인 과거참고, 2026 48건 실적집계와 분리. 매각차손과 현금개선 구분. 철거견적 합계혼재 확인필요.','folder':p['report_folder'].replace('/','\\'),'locator':'보고서 본문 비교표, 매매계약서, 철거견적서','classification':'2025 기안 참고','quote':None,'nego':None,'oneoff':None,'scrap':None,'conflict':'철거견적6,050,000원 기준이며 잔여셀6,060,000원 등 혼재'})
reports.sort(key=lambda r:(r['date'],r['id']))
d['reports']=reports;d['kpi']=inv['kpi'];d['prior_example']=p
d['conflicts']=[{'subject':x['source'],'issue':x['issue'],'treatment':x['treatment']} for x in inv['conflicts']]
for r in reports:
    if r['conflict']:d['conflicts'].append({'subject':r['id'],'issue':r['conflict'],'treatment':'원문값을 보존하고 수치확정 전 합산·연환산 보류'})
d['conflicts'] += [
 {'subject':'2027 통합관제 목표','issue':'20백만원↓ 표기는 2028 목표. 감소액인지 비용상한인지 불명확.','treatment':'2027 절감 합계 제외. 기준 수리비·범위·목표 의미 확인'},
 {'subject':'2026 감속기 긴급수리 견적','issue':'본문 견적9,480,000 vs 첨부9,476,000원(4,000원 차이). 계약9,000,000원.','treatment':'확정 계약가와 사고지출만 활용. 견적대비 차액은 원문별로 분리'},
 {'subject':'2026 인력절감 목표','issue':'충진라인 기안96백만원/년은 4→2명 목표. 완료의견상 TO1명↓, 추가1명예정.','treatment':'현금절감 확정 전 급여·잔업·배치전환 확인. 자동화 투자에 감축률 전용 금지'},
 {'subject':'2026 투자금액과 절감액','issue':'공사비·예산잔액·고철회수·견적차액·위험회피 금액이 성격상 다름.','treatment':'연간 운영절감과 일회성 투자회피, 회수수입을 별도 관리'},
 {'subject':'절감 확인절차','issue':'2027 미래실적과 시간당 공헌이익, 신품 대안견적 등이 제공되지 않음.','treatment':'미산정을 0원으로 대체하지 않음. 전후계량·동등범위 견적·재경 확인 후 인정'}]
(P/'workbook_data.json').write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
assert len(reports)==49 and sum(x['classification']!='2025 기안 참고' for x in reports)==48
assert sum(x['budget_m'] for x in d['items'])==1795
print('Prepared 14 investments and 49 report rows')
