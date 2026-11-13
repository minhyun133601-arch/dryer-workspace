import json
from decimal import Decimal
from pathlib import Path
from evidence_paths import load_source_json

WORK=Path(__file__).resolve().parent
meta=load_source_json(WORK/'doc_source.json')
att=Path(meta['attachmentDir'])
files={p.name:p.as_posix() for p in att.iterdir() if p.is_file()}
q=next(n for n in files if '견적' in n)
x=next(n for n in files if n.endswith('.xls'))
s=next(n for n in files if n.endswith('.xlsx'))
b=meta['bodyPdfPath']

def fact(id,label,value,unit,status,source,locator,note=''):
    return dict(id=id,label=label,value=value,unit=unit,status=status,sourceFile=source,sourceLocator=locator,note=note)

facts=[
fact('equipment_contract','아인시스템 선정 계약액',700000000,'원','원문 확인',b,'본문 4.투자금액/6.지급조건','VAT 별도. 장비/설치 계약이며 지급 완료액이 아닙니다.'),
fact('quote','NEGO 전 원 견적',745000000,'원','원문 확인',files[q],'견적서 p1 합계금액','VAT 별도. p1에도 NEGO 700,000,000원 기재.'),
fact('nego','원 견적 대비 조정액',45000000,'원','계산',files[q],'745,000,000 - 700,000,000','일회성 계약 조정액. 매년 가스비 절감액에 가산하지 않습니다.'),
fact('diagnosis_estimate','구조진단 예상비',4000000,'원','원문 확인',b,'본문 5.설치 후 투자회수기간 공사(설치)금액','추후 진행. 이 표에서 부가세 조건은 별도 명기되지 않습니다.'),
fact('roof_estimate','지붕 공사 예상비',20000000,'원','원문 확인',b,'본문 5.설치 후 투자회수기간 공사(설치)금액','예상금액. 이 표에서 부가세 조건은 별도 명기되지 않습니다.'),
fact('total_estimate','원문 총 예상투자비',724000000,'원','원문 확인',b,'본문 5.설치 후 투자회수기간 비용합계','700,000,000+4,000,000+20,000,000. 구조보강·바닥천공 등의 모든 추가비용이 확정됐다는 의미는 아닙니다.'),
fact('deposit','계약금 40%',280000000,'원','원문 확인',b,'본문 6.지급조건','VAT 별도. 계약서 작성 및 계약이행증권 접수 후. 계약 총액의 구성액입니다.'),
fact('balance','잔금 60%',420000000,'원','원문 확인',b,'본문 6.지급조건','VAT 별도. 완료보고서/성능보증/하자이행증권 접수 후. 계약 총액의 구성액입니다.'),
fact('gas_reduction','예상 가스 절감량',21.45,'m³/h','원문 확인',b,'본문 5.설치 후 투자회수기간 절약되는 가스량','가스 종류·발열량·버너 효율을 거쳐 열회수량에서 이 값으로 환산하는 상세 근거는 첨부 XLS에 없습니다.'),
fact('gas_unit_price','가스 단가 가정',1800,'원/m³','원문 확인',b,'본문 5.설치 후 투자회수기간 1시간 절약금액 비고','원문은 단가 유동적이라고 명기. 가스 종류별 적용 조건 및 세금/요금범위 확인 필요.'),
fact('hourly_gas_benefit','예상 시간당 가스비 절감',38610,'원/h','원문 확인',b,'본문 5.설치 후 투자회수기간 1시간 절약금액','21.45×1,800과 정확히 일치.'),
fact('daily_gas_benefit','예상 일일 가스비 절감',926640,'원/일','원문 확인',b,'본문 5.설치 후 투자회수기간 1일 절약금액','24시간 가동 가정. 38,610×24와 정확히 일치.'),
fact('days','연간 가동일수 가정',300,'일/년','원문 확인',b,'본문 5.설치 후 투자회수기간 년간 절감금액','실적 가동일수로 확인된 값이 아닙니다.'),
fact('annual_gas_benefit','예상 연간 가스비 절감',277992000,'원/년','원문 확인',b,'본문 5.설치 후 투자회수기간 년간 절감금액','38,610×24×300과 정확히 일치. 팬의 순증 전력비·정비비를 차감한 순절감액으로 제시되지 않았습니다.'),
fact('source_payback','기안 기재 단순회수기간',2.6,'년','원문 확인',b,'본문 5.설치 후 투자회수기간 투자회수기간','724,000,000÷277,992,000=2.60439149년을 한 자리로 반올림한 값과 정합.'),
fact('calculated_payback','총 예상투자비 기준 재계산 회수기간',float(Decimal(724000000)/Decimal(277992000)),'년','계산',b,'724,000,000÷277,992,000','가스비 절감만 사용한 단순회수기간. 전력·정비·정지 대응비·자본비용·할인율 반영 전.'),
fact('equipment_only_payback','장비계약액만 사용한 회수기간',float(Decimal(700000000)/Decimal(277992000)),'년','계산',b,'700,000,000÷277,992,000','부대 예상비를 제외한 비교값. 전체 사업 회수기간과 구분.'),
fact('annual_hours','연간 환산 가동시간',7200,'h/년','계산',b,'24×300','24시간 및 300일 가정으로 환산한 값.'),
fact('annual_gas_volume','연간 환산 가스 절감량',154440,'m³/년','계산',b,'21.45×24×300','실적 측정량이 아닙니다.'),
fact('body_fresh_in','기안 급기 입구온도',20,'℃','원문 확인',b,'본문 5.투자회수기간 현재온도','주변 온도 표기.'),
fact('body_fresh_out','기안 열교환 후 공급온도',59,'℃','원문 확인',b,'본문 5.투자회수기간 열교환기 설치후 공급온도','비고에 1차85℃ 표기. 첨부자료의 61/62/65℃와 다른 값입니다.'),
fact('quote_supply_mass','견적 급기 질량유량',55000,'kg/h','원문 확인',files[q],'견적 p2 ITEM01 Supply air','kg/h와 m³/h는 직접 같은 단위가 아닙니다.'),
fact('quote_exhaust_mass','견적 배기 질량유량',93000,'kg/h','원문 확인',files[q],'견적 p2 ITEM01 Exhaust air'),
fact('quote_supply_in','견적 급기 입구온도',20,'℃','원문 확인',files[q],'견적 p2 ITEM01'),
fact('quote_supply_out','견적 급기 출구온도',62,'℃','원문 확인',files[q],'견적 p2 ITEM01'),
fact('quote_exhaust_in','견적 배기 입구온도',90,'℃','원문 확인',files[q],'견적 p2 ITEM01'),
fact('quote_exhaust_out','견적 배기 출구온도',64,'℃','원문 확인',files[q],'견적 p2 ITEM01'),
fact('quote_heat_duty','견적 열교환량',554000,'kcal/h','원문 확인',files[q],'견적 p2 ITEM01 Heat duty'),
fact('xls_supply_in','HTRI 급기 입구온도',20,'℃','원문 확인',files[x],"'1 - Output Summary'!H16"),
fact('xls_supply_out','HTRI 급기 출구온도',65,'℃','원문 확인',files[x],"'1 - Output Summary'!K16"),
fact('xls_exhaust_in','HTRI 배기 입구온도',90,'℃','원문 확인',files[x],"'1 - Output Summary'!O16"),
fact('xls_exhaust_out','HTRI 배기 출구온도',63.48,'℃','원문 확인',files[x],"'1 - Output Summary'!S16"),
fact('xls_heat_duty_raw','HTRI Total duty 원문',0.597,'MM kcal/h','원문 확인',files[x],"'1 - Output Summary'!H32 및 E32"),
fact('xls_heat_duty','HTRI Total duty 단위 환산',597000,'kcal/h','계산',files[x],'0.597×1,000,000','HTRI 원문 MM kcal/h 표기에서 환산. 견적 554,000kcal/h와 다릅니다.'),
fact('xls_note_i17','XLS 별도 주석 I17','20℃','문자','원문 확인',files[x],"'1 - Output Summary'!I17"),
fact('xls_note_m17','XLS 별도 주석 M17','61℃','문자','원문 확인',files[x],"'1 - Output Summary'!M17"),
fact('xls_note_q17','XLS 별도 주석 Q17','85℃','문자','원문 확인',files[x],"'1 - Output Summary'!Q17"),
fact('xls_note_u17','XLS 별도 주석 U17','60.8℃','문자','원문 확인',files[x],"'1 - Output Summary'!U17"),
fact('fan_rating','견적 Exhaust fan 모터 정격',200,'kW','원문 확인',files[q],'견적 p2 ITEM07 motor','정격이 실제 소비전력 또는 순증 전력이 아닙니다. 기존 fan 철거·신품 설치가 스케줄에 확인됩니다.'),
]

issues=[
dict(id='gas_conversion_missing',severity='중점 확인',description='21.45m³/h를 도출한 열량→연료 환산 근거 미확인',evidence='XLS는 HTRI 결과표이며 Excel COM으로 UsedRange A1:IU69의 수식 0개 확인. 상단 B1의 그림 1개 외 계산표 이미지 없음.',required='LPG/LNG 중 적용 연료, 발열량과 기준상태/단위, 버너 효율, 회수열량 중 실제 버너 대체분, 계절·부하별 적용시간을 연결한 성능보증 계산서.'),
dict(id='conditions_conflict',severity='중점 확인',description='기안·견적·HTRI·별도주석의 온도/열량 조건이 서로 다름',evidence='본문20→59℃,견적20→62℃/554,000kcal/h,HTRI20→65℃/597,000kcal/h, XLS별도주석20/61/85/60.8℃.',required='발주/성능보증 최종 조건을 한 세트로 확정하고 그 조건에서 가스절감21.45m³/h를 재확인.'),
dict(id='net_benefit_missing',severity='중점 확인',description='원문 277,992,000원은 가스비 절감액이며 순운영비 절감액은 미산정',evidence='견적 Exhaust fan 200kW. 스케줄 B16 배기팬 철거 및 설치, A27 기존 fan 철거 전 지붕 일부철거 작업.',required='기존/신규 팬 실부하 kW와 가동시간, 필터 차압·세척/CIP·교체/정비비, 전기요금 적용조건. 팬 교체 후 순증 전력비만 별도 계산.'),
dict(id='auxiliary_capex',severity='금액 확인',description='724,000,000원은 원문 예상금액이며 모든 자사 SCOPE의 최종정산 상한이 아님',evidence='장비700M+구조진단4M+지붕20M. 본문은 필요 시 구조물 보강과 바닥천공1200mm를 자사SCOPE로 명시하며 견적서p1은 콘크리트HOLE/지붕작업 제외.',required='진단 결과에 따른 보강비, 천공비, 인양/현장 간섭·기타 자사부대비, 부대24M의 VAT 조건을 확정.'),
dict(id='quote_detail_comma',severity='금액 확인',description='견적 내역 3항목의 쉼표/자리수 표기 오류',evidence='p2 #06 40,00,000 / #07 85,00,000 / p3 #14 50,00,000. 문자 그대로4M+8.5M+5M로 넣으면 전체내역587.5M로 총견적745M와 불일치.',required='업체 정정 내역서. 40M/85M/50M로 해석하면745M와 정합하지만 이는 역산 추정으로 확정 채택하지 않음.'),
dict(id='payment_version',severity='조건 확인',description='견적 50%/50%와 승인기안 40%/60%의 조건 차이',evidence='견적p1 50/50, 본문6 280M(40%)/420M(60%) 및 증권/검수 서류조건.',required='체결 계약서와 세금계산서/이체내역에서 최종40/60 조건 이행 및 지급완료 여부 확인.'),
dict(id='guarantee_status',severity='상태 확인',description='결재의견의 보장수치 표현과 정식 성능보증 자료를 구분',evidence='임원결재의견 2026-01-22 현재 효과는 보수적으로 본 결과이며 보장수치. 본문 잔금은 완료보고서/성능보증/하자이행증권 접수후.',required='21.45m³/h 또는 온도/열량의 구체적 보증조건·시험절차·미달 조치가 담긴 계약/성능보증서.'),
dict(id='completion_status',severity='상태 확인',description='기안 승인과 설치·검수·지급 완료가 다름',evidence='기안작성2026-01-21/최종승인2026-02-12. 확보자료에서 이 사업 완료보고는 미매칭.',required='착공·진척·설치완료·성능검수·최종지급 보고. 2026-11-03은 계획공사2026-10-01~11-10 기간 중이지만 실제진행을 날짜로 추정하지 않음.'),
]
derived={
'hourlyFormula':'21.45*1800=38610',
'dailyFormula':'38610*24=926640',
'annualFormula':'926640*300=277992000',
'capexFormula':'700000000+4000000+20000000=724000000',
'paymentFormula':'280000000+420000000=700000000',
'paybackYears':float(Decimal(724000000)/Decimal(277992000)),
'equipmentOnlyPaybackYears':float(Decimal(700000000)/Decimal(277992000)),
'gasUnitCostRequiredForThreeYearGrossPaybackKRWperM3':float(Decimal(724000000)/Decimal(3)/Decimal('21.45')/Decimal(7200)),
'annualAdditionalCostAllowedAtThreeYearPaybackKRW':float(Decimal(277992000)-Decimal(724000000)/Decimal(3)),
'impliedEnergyPerGasM3FromQuote':float(Decimal(554000)/Decimal('21.45')),
'impliedEnergyPerGasM3FromHTRI':float(Decimal(597000)/Decimal('21.45')),
'impliedEnergyNote':'마지막 두 값은 열량/가스절감 단순 역산이며 발열량이나 효율의 확정값이 아닙니다. 연료·기준상태·버너효율을 확인해야 합니다.',
}
audit={'docId':'334757','docNo':meta['docNo'],'asOf':'2026-11-03','status':'기안 승인 확인·완료보고/실집행 미확인',
'facts':facts,'issues':issues,'derived':derived,
'sourceFiles':files,'bodyPdfPath':b,'bodyJpgPath':meta['bodyJpgPath'],
'xlsFormulaCheck':{'readOnly':True,'sourceUnchanged':True,'sheet':'1 - Output Summary','usedRange':'$A$1:$IU$69','formulaCount':0,'shapeCount':1,'shapeType':'Picture at B1 top-left,133.5x53.25pt'},
'reviewMethod':'본문 JPG 육안,PDF p1~3 텍스트 및 렌더, XLS xlrd 셀값 및 별도 Excel COM ReadOnly Formula 전수검사. 통합문서 원본 저장·변경 없음.'}
(WORK/'finance_audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
lines=['# 건조기 열교환기 재무·열량 근거 검토','',f"- 기준일: {audit['asOf']}",f"- 문서: {audit['docNo']}",'- 결론: 원문 가스비 절감 산술과 2.6년 회수 산술은 맞으며, 순절감과 가스절감량 도출근거는 추가 확인이 필요합니다.','',
'## 확인한 금액과 산식','',
'- 장비 채택 700,000,000원(VAT별도); 구조진단4,000,000원·지붕20,000,000원 예상; 원문합계724,000,000원. 부대비의 부가세 조건은 표내 미표기.',
'- 21.45m³/h ×1,800원/m³ =38,610원/h ×24h ×300일 =277,992,000원/년.',
f"- 724,000,000÷277,992,000={derived['paybackYears']:.8f}년 → 원문2.6년과 정합. 장비액만 사용하면{derived['equipmentOnlyPaybackYears']:.8f}년.",
'- 계약금280M+잔금420M은700M의 구성이고, 별도 투자액으로 가산하지 않습니다.','',
'## 중점 확인사항','']
for issue in issues:
    lines.extend([f"### {issue['description']}",issue['evidence'],'확인할 자료: '+issue['required'],''])
lines.extend(['## 원문 위치',''])
for f in facts:
    lines.append(f"- {f['label']}: {f['value']} {f['unit']} [{f['status']}] — {Path(f['sourceFile']).name} / {f['sourceLocator']}")
(WORK/'finance_audit_notes.md').write_text('\n'.join(lines),encoding='utf8')
print(json.dumps({'facts':len(facts),'issues':len(issues),'derived':derived},ensure_ascii=False,indent=2))
