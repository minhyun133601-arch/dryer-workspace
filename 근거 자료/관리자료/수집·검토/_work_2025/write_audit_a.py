import json
from decimal import Decimal
from pathlib import Path

ROOT=Path(__file__).resolve().parent
manifest={r['docId']:r for r in json.loads((ROOT/'download_manifest.json').read_text(encoding='utf8'))}
inventory=sorted(json.loads((ROOT/'report_inventory.json').read_text(encoding='utf8')),key=lambda r:r['cells'][2])[:20]

specs={
'290657':dict(costM=85,rawCostM=85,workYear=2024,costYear=2024,primaryPlanId='common-energy',
 summary='야경유 이중자켓 배관과 자동밸브·제어를 보수하고 펌프실 판넬을 설치했습니다.',result='동절기 응고와 국부 스팀 분사 위험을 줄였으며 시운전 상태가 양호하다고 보고했습니다.',
 sourceEvidence='공사금액: 이중자켓 배관 81,000,000원 + 펌프실 판넬 4,000,000원, VAT별도.',
 sourceCostComponents=[{'label':'이중자켓 배관','costM':81},{'label':'펌프실 판넬','costM':4}],
 caveats=['공사일정은 2024.12.03~12.11입니다. 2025년 보고 기준 금액이며 2025년 신규 시공비나 현금 지급액 합계로 보지 않습니다.','배관 선금 40.5백만원과 잔금 40.5백만원은 총액 81백만원의 분할금이므로 다시 더하지 않습니다.'],relationNote='열원·배관 공통 유지보수 사례입니다.'),
'290866':dict(costM=28.5,workYear=2024,costYear=2024,primaryPlanId='common-energy',
 summary='물류센터 보일러실에서 야드 히팅 장소까지 65A 스팀 배관 70m를 설치했습니다.',result='2024년 12월 공사와 무부하 시운전을 완료했습니다.',
 sourceEvidence='공사기간 24.12.10~12.30, 공사금액 28,500,000원/VAT별도.',
 caveats=['2024년 시공의 2025년 완료보고입니다. 잔금 지급예정이라는 보고이므로 실제 지급일을 2025년으로 확정하지 않습니다.'],relationNote='스팀·유틸리티 공통 설비공사 사례입니다.'),
'291144':dict(costM=52,workYear=2024,costYear=2024,primaryPlanId='14',
 summary='북정 공장 A·C·J동의 노후 옥상 방수를 보수했습니다.',result='현장 확인 완료 의견이 기록되어 있습니다.',
 sourceEvidence='공사기간 24.12.11~12.30, 공사금액 52,000,000원/VAT별도.',
 caveats=['2024년 시공을 2025년 보고한 자료입니다.','옥상 3개동 공사이며 2027년 생산동 외부 판넬 방수와 대상·면적·공법이 다릅니다.','계약금과 잔금 각 26백만원은 총액 52백만원의 분할 지급입니다.'],relationNote='방수 기능의 유사 공사이며 옥상과 외벽 판넬의 범위는 다릅니다.'),
'291240':dict(costM=90,workYear='2024-2025',costYear=2025,primaryPlanId='common-disposal',
 summary='북정 공장 노후 굴뚝 20m와 2층 슬라브 건물을 철거하고 행정서류를 제출했습니다.',result='공사를 완료하고 검수 후 잔금 지급을 예정했습니다.',
 sourceEvidence='공사기간 24.12.21~25.01.04, 공사금액 90,000,000원/VAT별도.',
 caveats=['2024~2025년을 걸친 공사 전체 계약금액입니다. 연도별 현금 지출로 분할하지 않았습니다.','계약금 54백만원과 잔금 36백만원은 총액 90백만원에 포함됩니다.'],relationNote='철거·시설 정리 공통 실적입니다.'),
'291786':dict(costM=None,rawVat='별도',workYear=2025,costYear=None,primaryPlanId='common-disposal',saleContractM=25,
 summary='액상 자동화 증설 공간을 확보하기 위해 대용량 로터리 1열 포장기 매각을 추진했습니다.',result='주관사에 25백만원으로 매각하기로 했으며 계약·입금 처리는 예정 상태입니다.',
 sourceEvidence='매각금액 25백만원(VAT별도), 매각계약서 작성 및 재경팀 입금 처리 예정.',
 caveats=['25백만원은 매각계약 금액으로 공사비와 별도입니다. 실제 입금 완료는 확인되지 않았습니다.','2024년 자산평가액 36백만원과 매각액 25백만원의 차이를 투자절감으로 더하지 않습니다.'],relationNote='유휴설비 매각·공간 확보 공통 사례입니다.',projectGroupId='liquid-automation-2025'),
'292371':dict(costM=5.642,rawCostM=6.2062,rawVat='포함',workYear='2024-2025',costYear=2025,primaryPlanId='04',expenseKind='시험분석비',
 summary='유산·북정 최종 방류구에서 수질오염물질 62종을 채수·시험 분석했습니다.',result='북정은 특이사항이 없고 유산에서 니켈이 소량 검출되어 신고필증 변경을 검토했습니다.',
 sourceEvidence='분석금액 6,206,200원(VAT포함), 2025.01.31 내 현금 지급.',
 caveats=['원문 VAT 포함액 6.2062백만원을 1.1로 나누어 공급가액 5.642백만원으로 통일했습니다.','시험분석 용역비이며 집수조 증설 공사 단가가 아닙니다.'],relationNote='폐수 운영·수질 확인을 위한 관련 관리비입니다.'),
'292646':dict(costM=11.5,workYear=2025,costYear=2025,primaryPlanId='01',
 summary='스틱 원료 배합부에 스크루컨베이어와 중량제어를 도입해 원료 이송 방식을 개선했습니다.',result='보고서상 작업자 투입 6명에서 2~3명, 수동 이송과 바닥 끌기 문제를 개선했습니다.',
 sourceEvidence='지급총금액 11,500,000원(VAT별도), 선금·잔금 각 5,750,000원.',
 caveats=['완료자료 표지는 2025.01.18이며 선금 5.75백만원은 2024.09.23 지급완료입니다. 2025년 보고 기준 전체 공사비이며 실제 연도별 현금지출과 다릅니다.','작업 투입 인원 감소를 인건비 현금 절감액으로 임의 환산하지 않았습니다.'],relationNote='수동작업 자동화의 유사 기능이며 조제실 전기설비와 대상·공종은 다릅니다.',supportingSourceLocators=['완료보고 PPT 1~2쪽: 2025.01.18, 지급총액·선금 지급일']),
'293157':dict(costM=None,rawVat='별도',workYear=2025,costYear=None,primaryPlanId='common-disposal',recoveryM=2.3025,
 summary='소포장 외포장실 자동화 설치로 철거한 노후 설비를 5회에 걸쳐 고철 처리했습니다.',result='고철 처리금액 2,302,500원을 보고했으며 입금 확인 후 완료보고 대체 예정입니다.',
 sourceEvidence='고철처리 2,302,500원/VAT별도, 재경팀 입금 처리 예정.',
 caveats=['고철 정산액은 공사비와 분리했습니다. 실제 입금 완료는 확인되지 않았습니다.'],relationNote='고철 회수 정산 공통 실적입니다.'),
'294576':dict(costM=8,workYear=2025,costYear=2025,primaryPlanId='05',
 summary='액상 100RT 냉동기 B호기의 일체형 증발기 내부 누설을 수리했습니다.',result='2025.02.10 시운전을 완료하고 추가 누기시험을 계획했습니다.',
 sourceEvidence='정비(수리)금액 8백만원/VAT별도, 정비 및 시운전 완료 후 100% 지급.',
 caveats=['냉동기 증발기 수리 사례로 2027년 압축공기 드라이어 개선과 설비·효과가 다릅니다.'],relationNote='에너지·냉동설비 유지보수의 관련 참고입니다.'),
'295910':dict(costM=None,rawVat='별도',workYear=2025,costYear=None,primaryPlanId='common-disposal',recoveryM=0.5415,
 summary='스틱포장기 8대의 라운드컷팅 개조 후 교체 부품을 고철 처리했습니다.',result='첨부 거래명세서의 작업철 570kg×950원=541,500원을 정산금액으로 확인했습니다.',
 sourceEvidence='첨부 XLSX 거래명세서: 작업철 570kg, 단가 950원, 금액 541,500원, VAT별도.',
 caveats=['본문에는 고철 금액이 없고 첨부의 거래명세서에서 확인한 금액입니다.','실제 입금 확인은 예정 상태입니다. 첨부 서식의 다른 잔여 합계 셀은 이번 거래금액으로 사용하지 않았습니다.'],relationNote='고철 회수 정산 공통 실적입니다.',supportingSourceLocators=['생산2팀(희창) 25년02.24 작업철.xlsx: 거래명세서 활성 표와 계량증명서 570kg']),
'294529':dict(costM=9.4,workYear=2025,costYear=2025,primaryPlanId='common-production',
 summary='제환기 2대의 스크루·체결부와 축 받침·베어링·하우징을 개선했습니다.',result='시운전 이상이 없고 고하중 대응 개선을 확인했다고 보고했습니다.',
 sourceEvidence='지급총금액 9,400,000원(VAT별도), 잔금 100%.',
 caveats=['다른 설비인 제환기 보수비이며 혼합기 신품가격이나 전기제어 교체비로 대체하지 않습니다.'],relationNote='생산설비 기계 보수 공통 사례입니다.'),
'298420':dict(costM=3.5,workYear=2025,costYear=2025,primaryPlanId='common-energy',
 summary='MSD 청정실 상부의 노후 CIP 드레인 PVC 배관을 교체했습니다.',result='2025.03.04~03.18 사용 점검 결과 양호하고 CIP 배수·누수 상태를 확인했습니다.',
 sourceEvidence='원본 본문 JPG: 공사금액 총3,500,000원(부가세별도), 공사기간 2025.03.01~03.03.',
 caveats=['HTML 추출 본문에는 공사금액이 빠져 있어 원본 본문 이미지에서 350만원을 직접 확인했습니다.','첨부 설치보고서의 종료연도 2024 표기는 본문 2025년 일정과 다른 오기로 보입니다.'],relationNote='CIP 배수·배관 공통 유지보수 사례입니다.',supportingSourceLocators=['문서 본문 JPG 완료보고서 3)공사금액, 5)공사기간'],imageVerified=True),
'300546':dict(costM=99,workYear=2025,costYear=2025,primaryPlanId='common-facilities',projectGroupId='liquid-automation-2025',
 summary='연속식 살균기와 델타로봇 설치를 위한 공간 확보, 건축·배관·소방·공조의 철거·복원 작업을 진행했습니다.',result='2025.02.28~03.30 현장 맞춤 작업으로 설비 설치를 마무리했습니다.',
 sourceEvidence='견적 정산금액 및 대금 지불 조건 모두99,000,000원/VAT별도.',
 caveats=['같은 액상 자동화 프로젝트의 유틸리티 설비 198.5백만원 및 1차 배관 26백만원과는 별도 보고·정산 범위입니다.','99백만원을 더 큰 프로젝트 전체 투자금액으로 해석하지 않았습니다.'],relationNote='설비 증설에 수반된 건축·철거·복원 공통 실적입니다.'),
'302104':dict(costM=26,quoteM=26.2182,oneoffReductionM=0.2182,workYear=2025,costYear=2025,primaryPlanId='common-energy',projectGroupId='liquid-automation-2025',
 summary='연속식 살균기와 델타로봇 등에 상수·스팀·냉각수·에어의 1차 유틸리티 배관을 증설했습니다.',result='배관 기밀 확인과 보온 작업을 마무리했습니다.',
 sourceEvidence='에어플랜 견적26,218,200원 → NEGO26,000,000원, 대금지불조건26백만원/VAT별도.',
 caveats=['선정업체의 네고 후 26백만원을 반영하며 타사 견적28.1백만원이나27백만원을 더하지 않습니다.','198.5백만원 설비공사와 같은 프로젝트이나 별도 1차 현장 배관 정산입니다. 설비공사 속 압력탱크·80A배관 19백만원과 범위·계약시기가 다릅니다.','견적차0.2182백만원은 일회성 협의 차액으로 공사비나 연간 절감액에 더하지 않습니다.'],relationNote='증설 유틸리티 현장 배관 공통 실적입니다.',supportingSourceLocators=['에어플랜 배관·보온견적서 2025.04.11: 50A/40A/65A/100A 신규 현장 배관']),
'302695':dict(costM=43,workYear=2025,costYear=2025,primaryPlanId='14',
 summary='생산2팀 9동의 노후 지붕 강판과 물홈통·내부 녹 부위를 보수했습니다.',result='2025.04.10 검수 완료 후 우천 시 누수가 없다고 보고했으며 하자보증 5년을 확보했습니다.',
 sourceEvidence='지급총금액43,000,000원(VAT별도), 계약금·잔금 각21,500,000원.',
 caveats=['표의 계약금 지급일2024.04.07은 공사완료2025.04.10 및 기안일과 연도가 어긋납니다. 금액43백만원은 명확하나 현금 지급일은 확정하지 않습니다.','지붕 강판·방수 공사와2027년 외벽 판넬 방수는 범위·면적이 다릅니다.'],relationNote='누수 방지·건물 외피 보수의 유사 기능입니다.'),
'304207':dict(costM=198.5,workYear=2025,costYear=2025,primaryPlanId='common-energy',projectGroupId='liquid-automation-2025',
 summary='액상 증설에 필요한 보일러1.5톤, 칠러40RT, 공압탱크·배관과 1차 전기를 설치했습니다.',result='살균기 스팀84~86℃, 냉각수13.3~20℃, 공압6.5~7.5bar 등 시운전 기준을 확인했습니다.',
 sourceEvidence='유틸리티 총공사금액198.5백만원VAT별도 = 보일러86 + 공압탱크·배관19 + 칠러86 + 1차전기7.5.',
 sourceCostComponents=[{'label':'보일러','costM':86},{'label':'공압탱크·80A배관','costM':19},{'label':'칠러','costM':86},{'label':'1차 전기','costM':7.5}],
 caveats=['총액198.5백만원 안에 선지급103백만원과 잔금95.5백만원이 포함되어 있어 분할 금액을 중복 합산하지 않습니다.','별도 보고302104의26백만원은 현장1차 유틸리티 배관 공사이며 이 설비 총액에 포함되지 않습니다.','원문과 계약서의 19백만원 공압탱크·배관은2025.02.12 계약, 26백만원 현장배관은2025.04.11 견적으로 계약시기·범위가 구분됩니다.'],relationNote='보일러·냉동·공압 기반 설비 공통 실적입니다.',supportingSourceLocators=['공압탱크·배관 계약서2쪽: 총20.9백만원VAT포함=공급가19백만원, 계약2025.02.12']),
'305350':dict(costM=1.8,workYear=2025,costYear=2025,primaryPlanId='13',
 summary='집진 덕트를 수정하고 외포장실 안전 팬스를 이설했습니다.',result='집진기 분진 비산을 줄이고 통로를 확보했습니다. 보고서에 양품 회수 증가와 월 제품 판매 가능액을 제시했습니다.',
 sourceEvidence='지급조건1,800,000원 현금 일시금 지급(VAT 제외).',
 caveats=['월255,279원은 보고서의 제품 판매 가능금액이며 순이익 또는 확인된 현금 절감액과 다릅니다.','집진 덕트와 팬스 이설의 합계 공사비1.8백만원이므로 백필터 단가로 대체하지 않습니다.'],relationNote='집진 성능과 작업환경 개선의 관련 참고입니다.'),
'306157':dict(costM=3.1,quoteM=6.2,quoteDifferenceM=3.1,oneoffReductionM=None,workYear=2025,costYear=2025,primaryPlanId='13',expenseKind='인허가 대행료',
 summary='대기오염물질 총량관리사업장 여부를 검토하고 도청에 자료를 제출했습니다.',result='보고서상 총량관리사업장에 해당하지 않아 신청 단계까지의 위탁료50%를 협의·지급하기로 했습니다.',
 sourceEvidence='지급금액3,100,000원; 첨부견적2쪽Final Nego3,100,000원VAT별도(기존6,200,000원).',
 caveats=['3.1백만원은 인허가 신청 대행료이며 설비 공사비·백필터 물품값과 다릅니다.','총량관리사업장에 해당하지 않아 허가완료까지의 업무가 신청 단계로 축소됐습니다. 기존견적6.2백만원과 지급3.1백만원의 차이를 동일범위 협상절감이나 반복 연간절감으로 확정하지 않습니다.'],relationNote='대기배출시설 운영·인허가의 관련 관리비입니다.',supportingSourceLocators=['첨부2견적서2쪽(2025.05.16): Final Nego3,100,000원VAT별도'],imageVerified=True),
'308032':dict(costM=14.9,workYear=2025,costYear=2025,primaryPlanId='common-facilities',
 summary='액상 배합실 출입구 두 곳에 위생전실·스피드도어와 에어커튼을 설치했습니다.',result='2025.05.08~05.24 공사 후 품질보증팀이 시운전에 참여했습니다.',
 sourceEvidence='스피드도어11,900,000원 + 위생전실 건축3,000,000원, 각각VAT별도.',
 sourceCostComponents=[{'label':'스피드도어2곳','costM':11.9},{'label':'위생전실 건축','costM':3}],
 caveats=['2개 업체 공사의 합계14.9백만원을 한 번 반영했습니다.'],relationNote='위생전실·출입구 공통 시설개선 사례입니다.'),
'309490':dict(costM=7,workYear=2025,costYear=2025,primaryPlanId='05',
 summary='급속냉동기 압축기 내부 압력밸브 파손·과부하에 대응해 압축기를 교체했습니다.',result='교체 후 냉동온도 영하30~33℃를 모니터링했으며 기존 압축기를 오버홀해 예비품을 확보할 계획입니다.',
 sourceEvidence='완료보고 금액7,000,000원; 관련물품구매서306011 총7,000,000원VAT별도.',
 caveats=['관련물품구매서의7백만원은 같은 교체건이므로 완료보고 금액에 다시 더하지 않습니다.','냉동 압축기와2027년 압축공기 드라이어는 다른 설비입니다.'],relationNote='압축·냉동설비 유지보수의 관련 참고입니다.',supportingSourceLocators=['공무환경팀-202505-물품구매서(09)-48 총금액7백만원VAT별도']),
}

result=[]
for row in inventory:
    doc=row['docId'];m=manifest[doc];s=specs[doc]
    r={k:m.get(k) for k in ('docId','docNo','date','title','sourceUrl')}
    r.update({'cohortYear':2025,'rawVat':'별도','vat':'별도 환산 기준','rawCostM':s.get('costM'),
              'budgetM':None,'quoteM':None,'recoveryM':None,'saleContractM':None,
              'expenseKind':'공사·정비비','costStatus':'완료보고 공사·정산금액(현금 지급일 기준 합계 아님)'})
    r.update(s)
    r['countedCostM']=r['costM']
    r['normalizedCostBasis']='VAT 별도 공급가액, 백만원'
    r['expenseGroupId']='expense-'+doc if r['costM'] is not None else None
    r['excludedReason']=None if r['costM'] is not None else ('매각계약액으로 공사비 합계 제외' if r.get('saleContractM') is not None else '고철 회수정산액으로 공사비 합계 제외')
    r['relatedDocIds']=[x['onclick'].split("'")[1] for x in m.get('relatedLinks',[]) if 'ViewBaseDoc' in x.get('onclick','')]
    if r['costM'] is None:r['costStatus']='회수·매각 보고(공사비 아님)'
    result.append(r)
assert len(result)==20
total=sum(Decimal(str(r['countedCostM'])) for r in result if r['countedCostM'] is not None)
(ROOT/'audit_2025_a.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'reports':len(result),'costReports':sum(r['costM'] is not None for r in result),'costM':str(total),'cashRecoveryReportedM':str(sum(Decimal(str(r['recoveryM'])) for r in result if r['recoveryM'] is not None)),'saleContractM':str(sum(Decimal(str(r['saleContractM'])) for r in result if r['saleContractM'] is not None))},ensure_ascii=False))
