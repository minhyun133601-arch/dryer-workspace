import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root=process.cwd(),work=path.join(root,'_work'),out=path.join(root,'outputs','2027_KPI_투자근거');
const d=JSON.parse(await fs.readFile(path.join(work,'workbook_data.json'),'utf8'));
const kqa=JSON.parse(await fs.readFile(path.join(work,'kpi_reconciliation.json'),'utf8'));
const wb=Workbook.create();
const names=['KPI요약','투자별근거','절감산정','2026정량사례','보고서검토대장','원문대조'];
const S=Object.fromEntries(names.map(n=>[n,wb.worksheets.add(n)]));
const C={navy:'#173154',blue:'#1F5A99',teal:'#28766C',light:'#F1F5F9',line:'#D3DCE6',ink:'#172B4D',gray:'#5C6776',input:'#FFF2CC',warn:'#FCE4D6',green:'#00804A'};
const money='#,##0;(#,##0);"-"';
function col(n){let x='';while(n){n--;x=String.fromCharCode(65+n%26)+x;n=Math.floor(n/26)}return x}
function put(s,addr,value){s.getRange(addr).values=[[value]]}
function formula(s,addr,x){s.getRange(addr).formulas=[[x]]}
function base(s,lastCol,lastRow,widths,title,note){
 s.showGridLines=false;s.getRange(`A1:${lastCol}${lastRow}`).format={font:{name:'Malgun Gothic',size:11,color:C.ink},verticalAlignment:'center',rowHeight:23};
 widths.forEach((w,i)=>s.getRange(`${col(i+1)}1:${col(i+1)}${lastRow}`).format.columnWidthPx=w);
 put(s,'A2',title);s.getRange(`A2:${lastCol}2`).format.font={name:'Malgun Gothic',size:16,bold:true,color:C.navy};
 s.getRange(`A2:${lastCol}2`).format.rowHeight=31;s.getRange(`A2:${lastCol}2`).format.borders={bottom:{style:'thin',color:C.navy}};
 put(s,'A3',note);s.getRange(`A3:${lastCol}3`).format.font={name:'Malgun Gothic',size:10,italic:true,color:C.gray};
}
function header(s,row,values){s.getRange(`A${row}:${col(values.length)}${row}`).values=[values];s.getRange(`A${row}:${col(values.length)}${row}`).format={fill:C.navy,font:{name:'Malgun Gothic',size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,rowHeight:36};}
function body(s,a1,rowheight=70){const r=s.getRange(a1);r.format.wrapText=true;r.format.rowHeight=rowheight;r.format.verticalAlignment='top';r.format.autofitRows();for(let i=0;i<r.values.length;i++){const rr=r.getRow(i),h=rr.format.rowHeight;rr.format.rowHeight=Math.max(24,(typeof h==='number'?h:20)+5);}}
function table(s,range,name){const t=s.tables.add(range,true,name);t.showFilterButton=true;return t}
function inputs(s,range,percent=false){const r=s.getRange(range);r.format.fill=C.input;r.format.font={name:'Malgun Gothic',size:11,color:'#0000FF'};r.setNumberFormat(percent?'0.0%':money);}
function linkStyle(s,range){s.getRange(range).format.font={name:'Malgun Gothic',size:11,color:C.green};}
function section(s,row,text,last='J'){put(s,`A${row}`,text);s.getRange(`A${row}:${last}${row}`).format={fill:C.light,font:{name:'Malgun Gothic',size:12,bold:true,color:C.navy},rowHeight:29};}
function sourceFor(id){return d.reports.find(x=>x.id.endsWith(id))}
function reportLocator(id,detail=''){const r=sourceFor(id);return r?`${r.id} / ${r.title} / ${detail||r.locator}`:id}

// 14개 투자계획과 근거. 금액 입력은 원문 백만원 그대로 보존한다.
{
 const s=S['투자별근거'];base(s,'P',23,[50,95,130,260,105,80,80,390,420,380,400,420,390,420,420,390],'2027 투자 항목별 개선·경제성 근거','금액: 백만원. 일정: 2027년. 계획예산 VAT 기준은 원문 미기재. 현재 승인 여부는 별도 확인.');
 header(s,5,['ID','구분','담당','투자항목','계획예산','시작월','완료월','현재 문제·필요성','개선 내용','2026 및 과거 연결 근거','금전 효과·상태','산정 방법','신규·중복투자 억제','추가 확보할 증빙','적용 한계·주의','2027 원문 출처']);
 const a=d.items.map(x=>[x.id,x.category,x.team,x.name,x.budget_m,x.start_month,x.end_month,x.problem,x.improvement,x.evidence,x.money,x.method,x.capital_control,x.inputs,x.limits,`27년 고정투자자산관련 총합본 20261014 rev03.pptx p${x.source_slide}`]);
 s.getRange('A6:P19').values=a;table(s,'A5:P19','InvestmentEvidence');body(s,'A6:P19',165);s.getRange('E6:G19').setNumberFormat('#,##0');s.getRange('E6:G19').format.font={name:'Malgun Gothic',size:11,color:'#0000FF'};
 put(s,'D20','전체 계획예산');formula(s,'E20','=SUM(E6:E19)');s.getRange('A20:P20').format.fill=C.light;s.getRange('D20:E20').format.font={name:'Malgun Gothic',size:11,bold:true,color:C.ink};s.getRange('E20').setNumberFormat('#,##0');
 s.getRange('A6:A19').setNumberFormat('00');s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(4);s.tabColor=C.navy;
}

// 2027 절감액 계산. 입력 누락을 0원 절감으로 표시하지 않는다.
{
 const s=S['절감산정'];base(s,'J',101,[62,260,395,140,140,140,145,135,150,570],'2027 절감액 산정·확인','금액: 원. 노란색/파란글씨는 입력, 검정은 산식, 초록은 다른 시트 참조. 미래실적 공란은 미산정으로 유지.');
 section(s,5,'압축공기 드라이어의 원문 목표와 2027 월할 목표');
 const labels=[['투자예산',null,'원','계획예산. 세금기준 별도 확인'],['연간 전력비 절감 목표',20000000,'원/년','원문 p8 목표이며 실측 확정액 아님'],['준공월 가정',null,'월','원문 1~3월 계획을 3월말 준공으로 가정'],['2027 효과 발생 개월',null,'개월','준공 익월부터 12월까지. 실제 가동일이 다르면 변경'],['2027 월할 목표',null,'원','월별 균등발생 가정. 계절성·실가동과 차이 가능'],['단순 투자회수기간',null,'년','연간 목표 20백만원을 모두 달성할 경우']];
 labels.forEach((r,i)=>{put(s,`B${6+i}`,r[0]);put(s,`C${6+i}`,r[1]);put(s,`D${6+i}`,r[2]);put(s,`E${6+i}`,r[3]);});
 formula(s,'C6',"='투자별근거'!E10*1000000");formula(s,'C8',"='투자별근거'!G10");formula(s,'C9','=IF(AND(ISNUMBER(C8),C8>=0,C8<=12),12-C8,"준공월 확인")');formula(s,'C10','=IF(ISNUMBER(C9),C7*C9/12,"미산정")');formula(s,'C11','=IF(C7>0,C6/C7,"미산정")');
 s.getRange('C6:C10').setNumberFormat(money);s.getRange('C11').setNumberFormat('0.0');linkStyle(s,'C6');linkStyle(s,'C8');inputs(s,'C7');body(s,'B6:D11',30);s.getRange('E6:J11').format.wrapText=false;
 put(s,'B13','목표와 실적 구분');put(s,'C13','연20,000,000원/2027월할15,000,000원은 목표. 아래 실측·재경 확인액과 합산하지 않는다.');
 section(s,15,'A. 2027 반복 운영비 절감. 동일 생산·가동·품질·가격 기준으로 보정');
 header(s,17,['ID','투자항목','비교할 비용·검증 조건','기존 방식 보정비용','개선 후 실제비용','추가 운영·유지비','차액 계산','재경 확인','인정 운영절감액','필요 증빙·귀속 기준']);
 d.items.forEach((x,i)=>{const r=18+i; const basis=x.id==='03'?'동일 운행횟수 기준 정비·검사 등 실제 운영비. 120/70 대안비용 비교는 아래 B구역에서 별도 관리.':x.id==='06'?'2027 데이터수집률90% 목표 중심. 별도 검증된 운영비 감소가 있는 경우만 입력. 2028 20백만원↓는 제외.':x.id==='08'||x.id==='11'||x.id==='12'||x.id==='13'?'동일 생산·성능 조건의 반복 수선·소모품·청소 등 실제 운영비 비교. 신품/보수 대안비용은 아래 B구역.':x.method;s.getRange(`A${r}:J${r}`).values=[[x.id,x.name,basis,null,null,null,null,'대기',null,x.inputs+' / '+x.limits]];formula(s,`G${r}`,`=IF(COUNT(D${r}:F${r})=3,D${r}-E${r}-F${r},"미산정")`);formula(s,`I${r}`,`=IF(AND(H${r}="확인",COUNT(D${r}:F${r})=3),G${r},"미확정")`);});
 body(s,'A18:J31',120);inputs(s,'D18:F31');inputs(s,'H18:H31');s.getRange('H18:H31').dataValidation={rule:{type:'list',values:['대기','확인']}};s.getRange('D18:I31').setNumberFormat(money);s.getRange('G18:G31').format.font={name:'Malgun Gothic',size:11,color:'#000000'};s.getRange('I18:I31').format.font={name:'Malgun Gothic',size:11,color:'#000000'};
 put(s,'B33','재경 확인 완료 건수');formula(s,'G33','=COUNT(I18:I31)');put(s,'B34','확인된 운영절감액만 합산');formula(s,'G34','=IF(COUNT(I18:I31)=0,"미확정",SUM(I18:I31))');s.getRange('G34').setNumberFormat(money);s.getRange('A34:J34').format.fill=C.light;
 put(s,'B35','미확정 건수');formula(s,'G35','=14-COUNT(I18:I31)');put(s,'J35','일부 건만 확인되면 합계는 확인분만 포함한다. 개별 비용을 둘 이상의 투자항목에 넣지 않는다.');
 section(s,38,'B. 일회성 신규·중복투자 회피. 운영비 절감과 별도 관리');
 header(s,40,['ID','투자항목','투자 억제 방법','동등 대안 견적','선택안 실제지출','추가 수명·유지비','대안 대비 차액','재경 확인','인정 일회성 회피액','필요 증빙·주의']);
 d.items.forEach((x,i)=>{const r=41+i;s.getRange(`A${r}:J${r}`).values=[[x.id,x.name,x.capital_control,null,null,null,null,'대기',null,x.id==='03'?'교체120백만원 vs 보강70백만원은 동일수명 대안이 아니다. 추가부담50, 조건부중복70을 자동절감으로 입력하지 않는다.':'동일 용량·품질·공사범위·세금·검토기간과 실제 대안 채택가능성을 확인한다. '+x.limits]];formula(s,`G${r}`,`=IF(COUNT(D${r}:F${r})=3,D${r}-E${r}-F${r},"미산정")`);formula(s,`I${r}`,`=IF(AND(H${r}="확인",COUNT(D${r}:F${r})=3),G${r},"미확정")`);});
 body(s,'A41:J54',120);inputs(s,'D41:F54');inputs(s,'H41:H54');s.getRange('H41:H54').dataValidation={rule:{type:'list',values:['대기','확인']}};s.getRange('D41:I54').setNumberFormat(money);
 put(s,'B56','확인된 일회성 회피액');formula(s,'G56','=IF(COUNT(I41:I54)=0,"미확정",SUM(I41:I54))');s.getRange('G56').setNumberFormat(money);put(s,'J56','투자비를 이연한 경우 이연기간도 명시한다. 예산잔액·고철매각수입과 중복 금지.');
 section(s,59,'C. 비가동 손실 위험 시나리오. 확정 현금절감액 합산 제외');
 header(s,61,['ID','투자항목','과거 정지시간 근거','과거 정지시간(h)','해당 투자 원인비율','예상 발생빈도/년','예방 가능한 비율','시간당 공헌이익','연간 위험회피 추정','전제·추가 자료']);
 d.items.forEach((x,i)=>{const r=62+i;const h={'01':24,'02':5.5,'10':105}[x.id]??null;s.getRange(`A${r}:J${r}`).values=[[x.id,x.name,h===null?'동일 설비·원인 이력 확보 필요':x.id==='01'?'KPI p7/202603-4, 기계적 모터·베어링 고장(PLC와 원인 다름)':x.id==='02'?'KPI p7, 2026.08.18 PLC 통신오류':'KPI p7, 2026.09.04 감속기 파손(PLC와 원인 다름)',h,null,null,null,null,null,'과거시간은 미래 매년 손실이 아님. 재고대응·잔업회복분을 제외한 미회복 공헌이익 기준. 안전보호기능 유지.']];formula(s,`I${r}`,`=IF(COUNT(D${r}:H${r})=5,D${r}*E${r}*F${r}*G${r}*H${r},"미산정")`);});
 body(s,'A62:J75',115);inputs(s,'E62:H75');s.getRange('D62:D75').setNumberFormat('0.00');s.getRange('E62:E75').setNumberFormat('0.0%');s.getRange('G62:G75').setNumberFormat('0.0%');s.getRange('I62:I75').setNumberFormat(money);
 section(s,79,'드라이어 실측 입력. 위 A절감의 ID05에 연결');
 [['기존 방식 보정전력',null,'kWh','2027 실제 효과 발생기간과 같은 생산량·가동시간·압력·노점 조건'],['개선 후 계통 전력',null,'kWh','히터·블로워·압축기 보조전력을 포함하는 동일 계량 경계'],['동일 전력단가',null,'원/kWh','동일 요금기준으로 비교, 요금변경 효과 분리'],['추가 운영·유지비',null,'원','계량범위 밖 보조전력비·추가유지비의 증감. 계통전력에 포함된 보조전력은 중복차감 금지. 증가면 양수, 감소면 음수.']].forEach((r,i)=>{put(s,`B${81+i}`,r[0]);put(s,`C${81+i}`,r[1]);put(s,`D${81+i}`,r[2]);put(s,`E${81+i}`,r[3]);});
 inputs(s,'C81:C84');body(s,'B81:D84',30);s.getRange('E81:J84').format.wrapText=false;
 formula(s,'D22','=IF(COUNT(C81,C83)=2,C81*C83,"")');formula(s,'E22','=IF(COUNT(C82,C83)=2,C82*C83,"")');formula(s,'F22','=IF(ISNUMBER(C84),C84,"")');s.getRange('D22:F22').format.fill=C.light;s.getRange('D22:F22').format.font={name:'Malgun Gothic',size:11,color:'#000000'};
 put(s,'B87','승강기 교체안');put(s,'C87',120000000);put(s,'D87','원');put(s,'B88','승강기 보강안');put(s,'C88',70000000);put(s,'D88','원');put(s,'B89','교체안 초기 추가부담');formula(s,'C89','=C87-C88');s.getRange('C87:C89').setNumberFormat(money);put(s,'E89','50백만원은 절감액이 아니라 교체안의 초기 추가부담. 보강후 조기교체가 불가피한 조건에서만 보강70백만원의 중복지출 회피 논리를 적용.');body(s,'B87:D89',30);s.getRange('E87:J89').format.wrapText=false;
 for(const r of ['A18:A31','A41:A54','A62:A75'])s.getRange(r).setNumberFormat('00');s.freezePanes.freezeRows(4);s.freezePanes.freezeColumns(2);s.tabColor=C.teal;
}

// 보고서 전수 검토대장: 2026 48건 + 2025 기안 참고 1건.
{
 const s=S['보고서검토대장'];base(s,'N',55,[105,235,385,125,125,115,380,400,470,420,500,145,620,650],'제공 보고서 전수 검토대장','2026년 보고서 48건 + 2025년 기안 참고 1건. 공사비는 절감액이 아니며 VAT 표기·실제 시공연도를 보존.');
 header(s,5,['작성일','문서번호','보고서 제목','시점 분류','공사·구매비(원)','VAT 표기','문제·현상','실행 조치','금전효과·결과','2027 투자 연결','한계·추가 확인','본문 파일','본문·첨부 위치','핵심 근거 위치']);
 const arr=d.reports.map(x=>[new Date(x.date+'T00:00:00Z'),x.id,x.title,x.classification,x.cost,x.vat,x.problem,x.action,x.effect,x.mapping,x.caution,null,x.folder,x.locator]);s.getRange('A6:N54').values=arr;table(s,'A5:N54','ReportReview');body(s,'A6:N54',158);s.getRange('E6:E54').setNumberFormat(money);s.getRange('A6:A54').setNumberFormat('yyyy-mm-dd');
 d.reports.forEach((r,i)=>put(s,`L${i+6}`,'보고서 본문.pdf'));s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(2);
}

// 올해의 실행 경험과 금전 수치. 서로 성격이 다른 금액을 합산하지 않는다.
{
 const s=S['2026정량사례'];base(s,'J',58,[55,240,200,175,150,150,155,480,500,500],'2026 정량 근거와 적용 한계','금액: 원. 계획·실측연환산·보고실적·지출·일회성 회수는 서로 다른 성격이며 총절감액으로 합산하지 않는다.');
 header(s,5,['No','사례','기준 시점','금액의 성격','비교값1','비교값2','결과 금액','해석·2027 적용','주의사항','원문 근거']);
 const rows=[
 ['Q01','냉동창고 이코노마이저','4시간 측정 연환산','연환산 절감',null,null,null,'동일조건 계량·운전시간·단가 공개의 방법론. 2027 드라이어 측정에 적용.','동절기 측정. 12개월 확정실적 아님. 하절기 추가 검증 필요.',reportLocator('202601-보고서-1','분석보고서)이코노마이저설치전,후.pdf p1~2')],
 ['Q02','인버터100Hp 전력비','2026.02~03','결재의견 보고절감',null,null,11400000,'실측 운전자료를 남긴 실행 경험.','첨부보고11.3백만원, 계량×160원 재계산12.17792백만원과 불일치.',reportLocator('202604-보고서-7','결재의견/완료보고서 p4')],
 ['Q03','인버터100Hp 전력비','2026.02~03','첨부 요약 보고절감',7300000,4000000,null,'2월7.3 + 3월4.0백만원.','결재의견 2월7.4와 다름. 최종 청구단가·보정기준 확인.',reportLocator('202604-보고서-7','완료보고서 p4')],
 ['Q04','인버터100Hp 전력계량','2026.02~03','계량값 재계산',null,null,null,'원시 전력량 차이×원문160원/kWh.','생산량·운전시간·요금 차이 보정 전. 2027 신규절감 합산 제외.',reportLocator('202604-보고서-7','완료보고서 p4 월별 사용량')],
 ['Q05','SD 충진라인 개조','2026 기안/완료','기안 인건비절감목표',null,null,96000000,'4→2명 목표. 완료의견상 전체TO1명 감소, 추가1명 예정.','급여·잔업·외주지출 감소 미확인. 배치전환을 현금절감으로 확정하지 않음.',reportLocator('희창생산팀-202605-보고서-2','2.기안서.pdf p1 및 완료 결재의견')],
 ['Q06','자체정비·업체발굴','2026.01~09','KPI 보고절감',16200000,6700000,null,'인정6건16.2백만원 + 실적외11건6.7백만원.','외주 대안견적·자체투입원가 검증 필요. 2027 반복절감으로 이월 금지.','(공무환경팀) 10월 KPI 20261102.pptx p8'],
 ['Q07','균질기 감속기 사고','2026.09~10','사고관련 지출',9000000,23800000,null,'긴급수리 후 신품구매. 예비품·조달계획 필요성 근거.','출고차질 없다는 결론. 전체 경과시간을 매출손실로 계산하지 않음.',reportLocator('202609-보고서-2')+'; '+reportLocator('202610-보고서-1')],
 ['Q08','균질기 감속기 신품','2026.10','견적대비 일회성 차액',28476700,23800000,null,'동일 견적범위에서 가격협의한 사례.','원문 견적/네고 기준. 2027 확정절감으로 재계상 금지.',reportLocator('202610-보고서-1','견적서/본문 금액')],
 ['Q09','팜유 교반기 오버홀','2026.04','견적대비 일회성 차액',15900000,14500000,null,'부분 오버홀·가격협의 적용 경험.','예산15백만원 잔액0.5와 네고1.4를 중복합산하지 않음.',reportLocator('202604-보고서-5')],
 ['Q10','건조기 STACK 연장','2026.05','견적대비 일회성 차액',17000000,16000000,null,'배출시설 공사 범위·가격협의 경험.','2027 집진시설과 공종·범위가 다름.',reportLocator('202605-보고서-4')],
 ['Q11','고철·철거품 회수3건','2026.01/04/05','일회성 회수 보고',null,null,null,'폐기품도 계근·매각·회수대금으로 관리하는 근거.','입금증빙 확인 필요. 2027 미래회수로 이월 불가.','202601-보고서-3, 202604-보고서-4, 202605-보고서-1 본문 표'],
 ['Q12','V-MIXER2기 매각','2025기안·2026승인','대안대비 일회성 현금개선',4000000,-2675000,null,'고철안 순지출2.675백만원 대비 매각수입4백만원.','과거 참고1건. 매각손익·장부가와 현금효과 구분. 철거견적 합계혼재 확인필요.','공무환경팀-202512-보고서-4 본문 비교표, 계약서, 철거견적서'],
 ['Q13','100Hp 압축기 집행','2026.04 보고','예산 미집행 잔액',120000000,115000000,null,'예산대비5백만원 잔액.','전력비 절감 또는 네고절감과 성격이 다름. KPI115.9백만원과 범위 확인.',reportLocator('202604-보고서-7','완료보고서 p3')],
 ['Q14','호퍼교반기 보수','2026.06','공사 지출',21000000,null,null,'축·임펠러 복원·모터수리로 기존설비 활용.','신품견적 없어 신규구매 회피액 미확정. 2027 혼합기와 다른 설비.',reportLocator('202606-보고서-4')],
 ['Q15','칠러 이코노마이저','2026.08','견적대비 일회성 차액',9515000,8800000,null,'계측·협의·동일범위 구매관리 경험.','장치 도입 후 에너지 절감 실측은 미제시.',reportLocator('202608-보고서-1')],
 ['Q16','소포장 컨베이어','2026.10','견적대비 일회성 차액',3737500,3700000,null,'유지보수 접근성 개선과 가격협의.','관리편의가 곧 인건비 현금절감은 아님.',reportLocator('202610-보고서-2')]
 ];s.getRange('A6:J21').values=rows;table(s,'A5:J21','QuantEvidence');body(s,'A6:J21',120);s.getRange('E6:G21').setNumberFormat(money);
 formula(s,'E6','=B32');formula(s,'F6','=B33');formula(s,'G6','=B34');formula(s,'G8','=SUM(E8:F8)');formula(s,'G9','=B41');formula(s,'G11','=SUM(E11:F11)');formula(s,'G12','=SUM(E12:F12)');[13,14,15,17,18,20,21].forEach(r=>formula(s,`G${r}`,`=E${r}-F${r}`));formula(s,'G16','=SUM(B45:B47)');put(s,'G19','미산정');
 section(s,24,'냉동창고 4시간 실측의 연환산 산식');
 const raw=[['측정시간(h)',4],['개선전 전력(kWh)',35.5],['개선후 전력(kWh)',21.8],['하루 운전시간 가정(h)',24],['연간 운전일 가정(일)',365],['전력단가(원/kWh)',160]];s.getRange('A25:B30').values=raw;inputs(s,'B25:B30');put(s,'A32','개선전 연환산 전력비');formula(s,'B32','=B26/B25*B28*B29*B30');put(s,'A33','개선후 연환산 전력비');formula(s,'B33','=B27/B25*B28*B29*B30');put(s,'A34','연환산 절감');formula(s,'B34','=B32-B33');put(s,'C34','원/년');put(s,'A35','감소율');formula(s,'B35','=(B26-B27)/B26');s.getRange('B35').setNumberFormat('0.0%');s.getRange('B32:B34').setNumberFormat(money);
 section(s,37,'인버터 압축기 2개월 원시 전력량 재계산');
 s.getRange('A38:D40').values=[['월','개선전kWh','개선후kWh','차이kWh'],['2026.02',96132,48669,null],['2026.03',104376,75727,null]];formula(s,'D39','=B39-C39');formula(s,'D40','=B40-C40');put(s,'A41','2개월 계량차이×160원');formula(s,'B41','=SUM(D39:D40)*B30');s.getRange('B41').setNumberFormat(money);put(s,'E41','11.4/11.3백만원 보고액과 불일치. 요금·원단위 보정 기준 확인 전 확정액 아님.');
 section(s,43,'고철·철거품 회수 보고액');s.getRange('A45:C47').values=[['압축기·탱크 고철',489600,'202601-보고서-3'],['카제인탱크 철거회수',2121000,'202604-보고서-4'],['보일러 부속 고철',577500,'202605-보고서-1']];s.getRange('B45:B47').setNumberFormat(money);s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(2);
}

// 원문 충돌과 KPI 대조. 원문실적을 임의로 고치지 않는다.
{
 const s=S['원문대조'];let rows=d.conflicts.map(x=>['계획·보고서',x.subject,x.issue,'','',x.treatment]);
 const qrows=Array.isArray(kqa)?kqa:(kqa.rows||[]);qrows.forEach(x=>rows.push(['KPI 대조',x.subject,String(x.source1||'')+' / '+String(x.value1??''),String(x.source2||''),String(x.value2??''),x.conclusion+(x.status?' ['+x.status+']':'')]));
 base(s,'F',rows.length+8,[140,390,570,430,230,700],'원문 수치·범위 대조 및 미확정 사항','원문합계가 맞아도 공사범위·세금·작성일/시공일이 다르면 실집행 합계로 확정하지 않는다.');header(s,5,['구분','항목·출처','원문1/불일치 내용','원문2','원문2 값','검토 결론·처리']);s.getRange(`A6:F${rows.length+5}`).values=rows;table(s,`A5:F${rows.length+5}`,'SourceReconciliation');body(s,`A6:F${rows.length+5}`,115);s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(2);
}

// 요약: 완성 결과만 가져오며, 확인되지 않은 금액은 수치 0으로 포장하지 않는다.
{
 const s=S['KPI요약'];base(s,'D',43,[310,185,135,820],'2027 KPI 투자계획 이행 근거','작성 기준 2026.11.03. 제공된 2027 계획과 2026 보고자료에 근거한 추진·검증안.');s.tabColor=C.navy;
 header(s,5,['주요 지표','금액·건수','단위','판단 근거·전제']);
 const rr=[['전체 투자계획',null,'백만원','고정자산 6건 + 수선비 8건, 총14건. 승인 여부·세금기준 별도 확인.'],['고정자산 계획',null,'백만원','전기·PLC·승강기·집수조·드라이어·관제 6건'],['수선비 계획',null,'백만원','노후 구동부·밸브·혼합기·환경시설 8건'],['드라이어 연간 절감 목표',null,'원/년','연2,000만원 목표. 퍼지14%→3%(11%p), 공급여력 약30마력. 실측 전 확정실적 아님.'],['드라이어 2027 월할 목표',null,'원','3월말 준공, 4~12월 정상가동·월별 균등효과 가정.'],['2027 확인된 운영절감',null,'원','계량·전표·비교조건 검증 후 재경 확인된 건만 포함. 미입력은 미확정.'],['2027 확인된 일회성 회피',null,'원','동등 대안견적·실제 선택안·수명·범위 확인 후 운영절감과 분리.'],['승강기 교체안 추가부담',null,'원','교체120백만원 - 보강70백만원 = 초기 추가50백만원. 절감액 아님.'],['원문 검토 범위',48,'2026 보고서','2025기안 V-MIXER 1건은 과거참고. 2027 계획17p·10월KPI9p 포함.']];
 s.getRange('A6:D14').values=rr;body(s,'A6:D14',53);
 const ff={B6:"=SUM('투자별근거'!E6:E19)",B7:"=SUMIF('투자별근거'!B6:B19,\"고정자산\",'투자별근거'!E6:E19)",B8:"=SUMIF('투자별근거'!B6:B19,\"수선비\",'투자별근거'!E6:E19)",B9:"='절감산정'!C7",B10:"='절감산정'!C10",B11:"='절감산정'!G34",B12:"='절감산정'!G56",B13:"='절감산정'!C89"};for(const [c,f]of Object.entries(ff))formula(s,c,f);s.getRange('B6:B14').setNumberFormat(money);s.getRange('B6:B14').format.font={name:'Malgun Gothic',size:12,bold:true,color:C.ink};
 section(s,16,'KPI 목표 문안(제안)','D');put(s,'A17','투자계획 이행·효과 검증');put(s,'D17',d.kpi_text);body(s,'A17:D17',190);
 section(s,19,'투자를 덜 쓰기 위한 실행 방향','D');
 const actions=[['추가 압축기 도입 검토 전','공급여력 실측','ID05','드라이어 교체 후 피크유량·압력·노점과 풀부하 시간을 검증한다. 공급여력 확보 시 압축기 추가구매 필요성을 재검토한다. 회피금액은 대안견적 확보 후 산정.'],['전면교체 범위 최소화','부분보수·수명연장','ID07~14','상태진단으로 본체·구동부 재사용 범위를 확정한다. 동등성능·보증수명·추가유지비를 포함한 신품/보수 비교견적으로 과잉투자를 억제한다.'],['제어·관제 중복구매 억제','기존 장비·부품 활용','ID01/02/06/10','기존 PC·통신·계측장비, 수리 가능한 모터·모듈을 재사용한다. 예비품은 중요도·납기에 따라 선별하고 보유자산·재고를 먼저 확인한다.'],['승강기 단일안 집행','생애비용 비교','ID03','보강70백만원 후 조기 전면교체가 불가피하면 중복지출이 생긴다. 잔여수명·검사비·수선비를 확인해 교체120백만원과 동일 검토기간으로 비교한다.'],['가격·철거품 회수관리','실제 증빙으로 인정','전체','동일범위 비교견적과 협의내역을 남기고 철거품은 재사용·매각·고철안의 순현금을 비교한다. 예산잔액·매각수입·운영절감을 구분한다.']];s.getRange('A20:D24').values=actions;body(s,'A20:D24',90);
 section(s,26,'성과 인정과 추가 확인','D');d.principles.forEach((x,i)=>{put(s,`A${27+i}`,String(i+1));put(s,`D${27+i}`,x)});body(s,'A27:D32',62);
 put(s,'A34','권장 관리 지표');put(s,'D34','승인된 완료대상 중 기한내 검수완료 건수/대상건수. 계획변경·이연은 승인기록으로 관리. 금액 집행률 자체를 절감성과로 사용하지 않는다.');body(s,'A34:D34',65);
 put(s,'A36','공무·생산·재경 역할');put(s,'D36','공무: 사양·계량·정지원인·검수. 생산: 생산량·가동시간·회복생산·불량. 재경: 단가·원가·공헌이익·실제 지출 및 절감액 확인.');body(s,'A36:D36',65);
 put(s,'A38','원문 유의사항');put(s,'D38','집수조 비용기간·도면단위, 인버터 전력비 수치, 기존 KPI 공사금액·에어햄머 중복 가능성은 원문대조 시트 참조. 원문을 임의로 수정하거나 연환산하지 않았다.');body(s,'A38:D38',70);
}

await fs.mkdir(out,{recursive:true});await fs.mkdir(path.join(work,'xlsx_previews'),{recursive:true});
wb.recalculate();
const summary=await wb.inspect({kind:'table',range:'KPI요약!A5:D14',include:'values,formulas',tableMaxRows:10,tableMaxCols:4,maxChars:6000});
const err=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'Final error scan',maxChars:5000});
await fs.writeFile(path.join(work,'workbook_check.ndjson'),summary.ndjson+'\n'+err.ndjson);
console.log(summary.ndjson);console.log(err.ndjson);
// 代表的な入力更新で計算・確認ゲートを検証し、全値を復元する。
const calc=S['절감산정'];
calc.getRange('C81:C84').values=[[10000],[8000],[160],[50000]];put(calc,'H22','확인');
if(calc.getRange('I22').values[0][0]!==270000)throw Error('Dryer input propagation failed');
if(S['KPI요약'].getRange('B11').values[0][0]!==270000)throw Error('Summary propagation failed');
put(calc,'H22','대기');if(calc.getRange('I22').values[0][0]!=='미확정')throw Error('Confirmation gate failed');
calc.getRange('C81:C84').values=[[null],[null],[null],[null]];calc.getRange('D18:F18').values=[[100],[120],[0]];put(calc,'H18','확인');
if(calc.getRange('I18').values[0][0]!==-20)throw Error('Negative saving was masked');
calc.getRange('D18:F18').values=[[null],[null],[null]];put(calc,'H18','대기');wb.recalculate();
const previews=[['KPI요약','A1:D14','summary'],['KPI요약','A16:D24','actions'],['투자별근거','A5:H9','investment_1'],['투자별근거','I5:P9','investment_2'],['절감산정','A5:J13','target'],['절감산정','A17:I22','calculation'],['2026정량사례','A5:H9','cases'],['보고서검토대장','A5:F10','reports'],['원문대조','A5:F9','reconcile']];
for(const[n,range,stem]of previews){try{const b=await wb.render({sheetName:n,range,scale:1,format:'png'});await fs.writeFile(path.join(work,'xlsx_previews',stem+'.png'),new Uint8Array(await b.arrayBuffer()));}catch(e){console.log('Preview',n,e.message)}}
const finalPath=path.join(out,'2027_KPI_투자이행_근거및절감산정.xlsx');await(await SpreadsheetFile.exportXlsx(wb)).save(finalPath);console.log('OUTPUT',finalPath);
