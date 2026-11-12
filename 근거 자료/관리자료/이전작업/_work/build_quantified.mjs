import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

const root=process.cwd(), dir=path.join(root,'outputs','2027_투자효과_정량보강');
await fs.mkdir(dir,{recursive:true});
const wb=Workbook.create();
const summary=wb.worksheets.add('투자효과비교');
const calc=wb.worksheets.add('단건산정');
const ink='#173154', gray='#526175', light='#EDF2F7', blue='#0000FF', green='#00804A';
const money='#,##0;(#,##0);"-"', decimal='#,##0.0;(#,##0.0);"-"';
const data=JSON.parse(await fs.readFile(path.join(root,'_work','content.json'),'utf8'));
const plan='27년 고정투자자산관련 총합본 20261014 rev03.pptx';
const kpi='(공무환경팀) 10월 KPI 20261102.pptx';
const put=(s,a,v)=>s.getRange(a).values=[[v]];
const form=(s,a,v)=>s.getRange(a).formulas=[[v]];
function base(s,last,widths){
 s.showGridLines=false;
 s.getRange(`A1:G${last}`).format={font:{name:'Malgun Gothic',size:11,color:ink},verticalAlignment:'center',rowHeight:26};
 widths.forEach((w,i)=>s.getRange(`${String.fromCharCode(65+i)}1:${String.fromCharCode(65+i)}${last}`).format.columnWidthPx=w);
 s.getRange(`B5:B${last}`).setNumberFormat(money);
 s.getRange('A2:F2').format.font={name:'Malgun Gothic',size:16,bold:true,color:ink};
 s.getRange('A2:F2').format.rowHeight=34;
 s.getRange('A2:F2').format.borders={bottom:{style:'thin',color:ink}};
}
function header(s,r,values){
 s.getRange(`A${r}:${String.fromCharCode(64+values.length)}${r}`).values=[values];
 s.getRange(`A${r}:${String.fromCharCode(64+values.length)}${r}`).format={fill:ink,font:{name:'Malgun Gothic',size:11,bold:true,color:'#FFFFFF'},rowHeight:38,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
}
function section(s,r,label){put(s,`A${r}`,label);s.getRange(`A${r}:E${r}`).format={fill:light,font:{name:'Malgun Gothic',size:12,bold:true,color:ink},rowHeight:30};}
function row(r,label,value,unit,kind,note,source,formula=false){
 calc.getRange(`A${r}:E${r}`).values=[[label,formula?null:value,unit,kind,note]];
 if(formula)form(calc,`B${r}`,value);
 if(source)put(calc,`G${r}`,source);
 calc.getRange(`A${r}:E${r}`).format.wrapText=true;
 calc.getRange(`G${r}`).format.wrapText=true;
 calc.getRange(`G${r}`).format.font={name:'Malgun Gothic',size:10,color:gray};
 calc.getRange(`A${r}:G${r}`).format.rowHeight=45;
 calc.getRange(`B${r}`).format.font={name:'Malgun Gothic',size:11,color:formula?'#000000':blue};
 if(kind.includes('입력')||kind.includes('가정'))calc.getRange(`B${r}`).format.fill='#FFF2CC';
}
base(calc,113,[260,160,90,165,410,24,540]);
put(calc,'A2','단건별 비용과 절감액 계산');
put(calc,'A3','금액은 원. 노란색은 작성 가정·추가 입력, 파란 글씨는 입력값. 출처는 G열.');
calc.getRange('A3:G3').format.font={name:'Malgun Gothic',size:10,italic:true,color:gray};
header(calc,5,['지표','금액·수량','단위','수치 성격','비교 조건']);

row(6,'드라이어 투자예산',70000000,'원','2027 계획','계획예산의 부가세 기준은 원문 미기재.',`${plan} p8`);
row(7,'정상운전 연간 절감 목표',20000000,'원/년','2027 목표','신규 히터·블로워 전력과 유지비 반영 여부 확인.',`${plan} p8`);
row(8,'준공월',3,'월','작성 가정','3월 말 준공, 익월부터 절감 발생. 0~12 입력.',`${plan} p8의 1~3월 일정에 근거한 작성 가정`);
row(9,'2027 효과 발생 개월','=12-B8','개월','계산','준공 익월부터 12월까지. 월별 균등발생 가정.','',true);
row(10,'2027 월할 절감 목표','=B7*B9/12','원','목표 계산','계절성과 실제 가동일에 따라 달라짐.','',true);
row(11,'별도 차감할 연간 추가운영비',null,'원/년','추가 입력','원문 목표에 미반영된 자체전력·소모품·유지비. 포함 확인 시 0 입력.');
row(12,'추가비용 확인 후 연간 순절감','=IF(COUNT(B11)=1,B7-B11,"추가비용 확인 필요")','원/년','입력 후 계산','절감 목표를 실적 확정액으로 간주하지 않음.','',true);
row(13,'원문 목표 기준 단순 회수기간','=IF(B7>0,B6/B7,"회수 불가")','년','목표 계산','추가운영비·세금·할인·잔존가치 미반영.','',true);
row(14,'추가비용 확인 후 회수기간','=IF(COUNT(B11)=0,"미산정",IF(B12>0,B6/B12,"회수 불가"))','년','입력 후 계산','연간 순절감이 양수일 때 계산.','',true);
row(15,'준공 1개월 지연의 절감기회 감소','=B7/12','원/개월','목표 계산','정상운전 목표의 1개월분. 확정 손실이 아님.','',true);
row(16,'2027 목표 절감에서 투자비 차감','=B10-B6','원','목표 기준 현금차이','추가운영비·세금·할인·지원금 미반영. 당해 순이익과 구분.','',true);
row(17,'완전 가동 비교기간',5,'년','작성 가정','달력상 2027~2031이 아닌 정상가동 60개월.');
row(18,'비교기간 절감에서 투자비 차감','=B7*B17-B6','원','목표 기준 현금차이','추가운영비·세금·할인 미반영. 목표가 유지될 때의 단순 계산.','',true);
row(19,'기존 퍼지 사용률',0.14,'비율','원문 계획','비가열식 흡착드라이어.',`${plan} p8`);
row(20,'개선 후 퍼지 사용률',0.03,'비율','원문 계획','블로워 히터 재생방식.',`${plan} p8`);
row(21,'퍼지 사용률 감소폭','=(B19-B20)*100','%p','계산','전체 전력비 절감률과 구분.','',true);
row(22,'압축기 합계 용량',250,'Hp','원문 계획','150Hp와 100Hp 합계.',`${plan} p8`);
row(23,'퍼지 감소에 따른 공급여력 단순환산','=B21/100*B22','Hp','용량 환산','제작사 보증·실제 압력/수요 확인 필요. 신규 압축기 투자회피액은 미산정.','',true);

section(calc,26,'승강기 보강 후 재교체와 즉시 교체 비교');
row(27,'즉시 전면교체',120000000,'원','2027 계획','안전장치 보강 포함 범위와 동등조건 견적 확인.',`${plan} p6`);
row(28,'기존기 안전장치 보강',70000000,'원','대안 계획','보강만 하는 초기 대안.',`${plan} p6`);
row(29,'보강 후 후속 전면교체','=B27','원','조건부 비교','동일 평가기간 안에 전면교체가 다시 필요한 경우. 교체시점·가격·잔존가치 미반영.','',true);
row(30,'보강 후 교체의 총 명목지출','=B28+B29','원','조건부 계산','보강품 재사용/공제 및 후속교체 필요성 확인.','',true);
row(31,'중복투자 회피 후보','=B30-B27','원','조건부 일회성','연간 절감 아님. 후속교체가 없다면 이 금액을 절감으로 주장할 수 없음.','',true);
row(32,'보강만 하는 대안 대비 초기 추가지출','=B27-B28','원','대안 비교','즉시 교체는 초기 지출이 더 큼.','',true);

section(calc,36,'조제실 자동화의 인력효율 단위 기준');
row(37,'2027 조제실 전기·자동화 예산',450000000,'원','2027 계획','전기설비 안전·노후교체가 포함된 전체 예산.',`${plan} p4`);
const auto='2026-05-11 SD 내포장실 지대충진라인 개조, 첨부 2.기안서.pdf p1';
row(38,'유사 자동화 공사비',25000000,'원','과거 투자','부가세 별도. 이번 조제실과 설비·범위가 다름.',auto);
row(39,'유사 사례 연간 인건비효율 목표',96000000,'원/년','과거 기안 목표','4명에서 2명 운영을 전제로 한 목표. 확정 현금절감 실적 아님.',auto);
row(40,'유사 사례 계획 감소 인원',2,'명','과거 기안 목표','보고일 결재의견은 실제 TO 1명 감소, 추가 1명 예정.',auto+' 및 보고서 정보.txt 2026-05-11 결재의견');
row(41,'계획 감소인원 1명당 연간 환산','=B39/B40','원/명·년','유사 사례 단위','2027 실제 임금/회피가능 비용의 대체값으로 확정 사용하지 않음.','',true);
row(42,'2027 회복 공수의 인원 환산 예시',1,'명','단위 예시 가정','이번 공사로 1명분 공수를 회복한다고 가정한 예시. 전망 인원 아님.');
row(43,'유사 단가로 평가한 인력효율 예시','=B41*B42','원/년','단위 예시','인력 재배치는 생산능력·업무여력 효과. 현금절감과 분리.','',true);
row(44,'실제로 회피할 유급 인원·공수 환산',null,'명','추가 입력','잔업·외주·추가채용 등의 현금지출 감소가 입증된 인원 환산.');
row(45,'2027 인원 1명당 회피가능 연간비용',null,'원/명·년','추가 입력','재경 확인 단가. 회피할 수 없는 고정급여는 제외.');
row(46,'확인 단가·공수 기준 현금절감','=IF(COUNT(B44:B45)=2,B44*B45,"미산정")','원/년','입력 후 계산','준공연도 실제 적용개월은 별도 반영.','',true);
row(47,'전체 예산에 상당하는 공수 환산','=B37/B41','명·년','유사 단가 비교','시간 절감만으로 전체 예산을 상쇄할 때의 비교량. 투자회수기간 아님.','',true);

section(calc,50,'건조실 PLC 정지 1건의 손실 계산');
row(51,'건조실 PLC 교체 예산',350000000,'원','2027 계획','균질기 PLC 21백만원 사업과 설비·범위를 구분.',`${plan} p5`);
row(52,'동일 PLC 장애 실제 정지',5.5,'시간/건','2026 실제 사건','2026-08-18. 중고 CPU 조달 1개월은 실제 정지시간 아님.',`${plan} p5 및 ${kpi} p7`);
row(53,'시간당 손실의 단위 예시',1000000,'원/시간','단위 예시 가정','매출액 아님. 회복 불가능 공헌이익 손실과 실제 추가비용만 산정.');
row(54,'예시에서 예방하는 정지시간','=B52','시간/건','전부 예방 가정','같은 규모 사건의 정지시간을 전부 줄인다는 단위 예시. 연간 예측 아님.','',true);
row(55,'동일 규모 1건 회피액 예시','=B53*B54','원/건','단위 예시','추가정비비·정상교체비와 중복 합산하지 않음.','',true);
row(56,'예시 손실단가로 투자비를 상쇄하는 시간','=IF(B53>0,B51/B53,"회수 불가")','시간','상쇄 기준','누적 예방 가능 시간이 이 수준에 도달해야 예산과 같아짐.','',true);
row(57,'과거 1건만으로 예산을 상쇄할 손실단가','=B51/B52','원/시간','상쇄 기준','단건만으로 투자비 전액 절감을 입증하기 어렵다는 비교 기준.','',true);
row(58,'연간 실제 예방가능 정지시간',null,'시간/년','추가 입력','고장 원인별 재발근거·예방범위 검증 후 입력.');
row(59,'검증된 시간당 실제 손실',null,'원/시간','추가 입력','회복 출하량과 평상시 고정급여를 손실로 중복 포함하지 않음.');
row(60,'검증 입력에 따른 연간 회피손실','=IF(COUNT(B58:B59)=2,B58*B59,"미산정")','원/년','입력 후 계산','2027 실제 효과 개월·계획 정지비용은 별도 검토.','',true);

section(calc,63,'감속기 긴급수리 후 교체의 실제 지출');
row(64,'긴급수리비',9000000,'원','2026 실제 지출','지그 2.5백만원과 탈거·수리 6.5백만원.', '2026-09-14 유산공장 건조기 균질기 감속기 고장 수리 완료 보고, 보고서 본문 및 첨부 최종보고.pdf');
row(65,'후속 신품 감속기 구매',23800000,'원','2026 실제 지출','같은 사고 이후 신품 교체. 선제 교체에도 필요한 구매비.', '2026-10-05 유산공장 건조기 균질기 감속기 수입 후 설치 작업 완료보고서, 본문');
row(66,'동일 사고의 수리·교체 총 지출','=B64+B65','원','과거 단건','전액을 절감 가능액으로 보지 않음.','',true);
row(67,'검토할 긴급수리 지출 범위 상한','=B64','원','조건 검토용 상한','호환 감속기 즉시 교체가 가능했다면 검토할 범위. 신규품 구매비 제외.','',true);
row(68,'호환 감속기 즉시 교체 가능성','미확인','상태','추가 입력','현 2027 예비품은 임팩트헤드·밸브시트. 감속기 확보는 현재 범위가 아님.',`${plan} p13`);
row(69,'계획교체에도 필요한 비용·보유 추가비용',null,'원','추가 입력','수리비에 포함된 정상 탈거/설치비와 예비품 보유 추가비용 등을 차감.');
row(70,'범위·차감비용 확인 후 회피 가능액','=IF(AND(B68="확인",COUNT(B69)=1),B67-B69,"미산정")','원/건','추가범위 검토 계산','현재 예비품 계획의 확정 효과가 아님. 추가 감속기 자금과 보유기간 별도 검토.','',true);
row(71,'KPI 기록 생산정지',105,'시간','2026 실제 사건','사전재고·탄력근무로 출고차질 없음. 정지시간에 매출을 곱하지 않음.',`${kpi} p7 및 2026-09-14 첨부 유산 2차균질기 긴급정지 건 최종보고.pdf p9`);

section(calc,74,'교체품 매각의 실제 대안 비교');
const sale='2025-12-05 생산2팀 V-MIXER(2기) 매각 처리 보고, 본문·철거 견적서·매각계약서. 2026-01-14 승인';
row(75,'고철처리안 철거비',6050000,'원','과거 대안 견적','매각안과 동일 2기 비교. 부가세 별도.',sale);
row(76,'고철처리안 회수금액',3375000,'원','과거 대안 견적','고철처리 대안의 회수액.',sale);
row(77,'고철처리안 순지출','=B75-B76','원','과거 대안 계산','철거비에서 고철 회수액 차감.','',true);
row(78,'매각안 매각대금',4000000,'원','과거 계약','매각가. 부가세 별도.',sale);
row(79,'매각안 매도인 철거·반출비',0,'원','과거 계약','매수인이 철거·반출·운송비 부담.',sale);
row(80,'매각안 순현금 유입','=B78-B79','원','과거 대안 계산','장부상 처분손익과 구분.','',true);
row(81,'고철처리 대비 매각 현금개선','=B77+B80','원','과거 단건','2027 교체품에 이 금액을 이월하지 않음.','',true);
row(82,'2027 교체품 철거안 순지출',null,'원','추가 입력','현재 교체대상에 대한 철거·고철 회수 견적.');
row(83,'2027 교체품 매각안 순현금 유입',null,'원','추가 입력','현재 교체대상의 매각가에서 매도인 부담 비용 차감.');
row(84,'현재 견적 기준 처분방식 현금차이','=IF(COUNT(B82:B83)=2,B82+B83,"미산정")','원/건','입력 후 계산','매각 가능성·반출조건을 확인한 동일 대상 비교.','',true);

section(calc,88,'2027 원문 투자예산');
header(calc,89,['ID','계획예산','단위','담당','투자항목']);
const items=data.items;
if(!items||items.length!==14)throw new Error('Expected 14 investment items');
items.forEach((x,i)=>{
 const r=90+i;
 calc.getRange(`A${r}:E${r}`).values=[[x.id,x.budget_m*1000000,'원',x.team,x.name]];
 put(calc,`G${r}`,`${plan} p${x.source_slide}`);
 calc.getRange(`A${r}:G${r}`).format.rowHeight=40;
 calc.getRange(`A${r}:G${r}`).format.wrapText=true;
 calc.getRange(`B${r}`).format.font={name:'Malgun Gothic',size:11,color:blue};
});
put(calc,'A105','전체 계획예산');form(calc,'B105','=SUM(B90:B103)');
put(calc,'E105','예산은 원문 기준. 승인 여부와 부가세 기준은 별도 확인.');
calc.getRange('E105').format.wrapText=true;calc.getRange('A105:G105').format.rowHeight=44;
calc.getRange('A105:E105').format.fill=light;
calc.getRange('B19:B20').setNumberFormat('0.0%');
calc.getRange('B21').setNumberFormat('0.0');
for(const r of [13,14,23,40,42,44,47,52,54,56,58])calc.getRange(`B${r}`).setNumberFormat(decimal);
calc.getRange('B8').dataValidation={rule:{type:'whole',operator:'between',formula1:0,formula2:12}};
calc.getRange('B68').dataValidation={rule:{type:'list',values:['미확인','확인','불가']}};
calc.freezePanes.freezeRows(5);calc.tabColor='#5D7999';

base(summary,35,[250,125,265,125,205,420,24]);
put(summary,'A2','2027 투자효과와 미실행 시 비용 비교');
put(summary,'A3','금액: 만원. 목표·조건부 회피·유사사례·단위 예시를 구분하며 합산하지 않음.');
summary.getRange('A3:F3').format.font={name:'Malgun Gothic',size:10,italic:true,color:gray};
header(summary,5,['투자·검토대상','2027 예산','정량 지표','금액','수치 성격','실행·미실행 비교 조건']);
const summaries=[
 ['압축공기 효율개선',"='단건산정'!B6/10000",'정상운전 연간 절감 목표',"='단건산정'!B7/10000",'연간 목표','미실행하면 같은 운전조건에서 전력비 절감기회를 놓침. 신규 설비 추가운영비 확인 필요.'],
 ['승강기 전면교체',"='단건산정'!B27/10000",'보강 후 재교체의 중복지출',"='단건산정'!B31/10000",'조건부 일회성 회피','안전보강 후 같은 평가기간 안에 전면교체가 다시 필요할 때 성립. 보강만 하는 초기 대안보다 지출 증가.'],
 ['조제실 자동화',"='단건산정'!B37/10000",'1명분 공수의 연간 환산',"='단건산정'!B41/10000",'유사 기안의 단위금액','과거 자동화의 인건비효율 목표를 인원으로 나눈 기준. 이번 공사의 감소공수·현금효과는 추가 확인.'],
 ['건조실 PLC 교체',"='단건산정'!B51/10000",'동일 정지 1건 회피액 예시',"='단건산정'!B55/10000",'단위 예시·연간 전망 아님','시간당 손실의 예시 단가와 과거 정지시간을 적용. 실제 단가·예방가능시간을 입력해야 산정 가능.'],
 ['감속기 예비품 추가 검토',null,'과거 긴급수리 지출 범위',"='단건산정'!B67/10000",'과거 지출·회피검토 상한','현재 예비품 계획은 감속기를 포함하지 않음. 신품 구매는 필요하며, 정상교체비·보유비 차감 후에만 회피액 계산.'],
 ['교체품 매각 검토',null,'고철처리 대비 현금개선',"='단건산정'!B81/10000",'과거 단건 대안 비교','V-MIXER 매각 사례. 2027 교체품도 매각가와 철거조건을 비교해 추가 지출을 줄일 수 있음. 현재 효과는 미산정.']
];
summaries.forEach((a,i)=>{
 const r=6+i;summary.getRange(`A${r}:F${r}`).values=[[a[0],null,a[2],null,a[4],a[5]]];
 if(a[1])form(summary,`B${r}`,a[1]);else put(summary,`B${r}`,'범위 별도');
 form(summary,`D${r}`,a[3]);
 summary.getRange(`A${r}:F${r}`).format.rowHeight=86;
 summary.getRange(`A${r}:F${r}`).format.wrapText=true;
 if(i%2===1)summary.getRange(`A${r}:F${r}`).format.fill='#F4F7FA';
});
summary.getRange('D6:D11').setNumberFormat(decimal);
summary.getRange('C6:C11').setNumberFormat('  @');
summary.getRange('E6:E11').setNumberFormat('  @');
form(summary,'F7','="보강 "&TEXT(\'단건산정\'!B28/10000,"#,##0")&"만원 후 다시 "&TEXT(\'단건산정\'!B29/10000,"#,##0")&"만원을 들여 교체할 때 성립. 후속교체 필요성·시점 확인."');
form(summary,'F9','="시간당 "&TEXT(\'단건산정\'!B53/10000,"#,##0")&"만원 손실, "&TEXT(\'단건산정\'!B54,"0.0")&"시간 전부 예방을 가정한 예시. 실제 단가·예방가능시간 추가 확인."');
put(summary,'A13','드라이어 2027 월할목표');form(summary,'B13',"='단건산정'!B10/10000");put(summary,'C13','만원, 3월 말 준공 가정');
put(summary,'D13','단순 회수기간');form(summary,'E13',"='단건산정'!B13");put(summary,'F13','년, 원문 연간 절감 목표 기준');summary.getRange('E13').setNumberFormat('0.0');
put(summary,'A14','준공 1개월 지연 시');form(summary,'B14',"='단건산정'!B15/10000");put(summary,'C14','만원의 목표 절감기회 감소');
put(summary,'D14','2027 현금차이');form(summary,'E14',"='단건산정'!B16/10000");put(summary,'F14','만원, 월할목표에서 투자비 차감. 추가운영비 등 미반영');
summary.getRange('B13:B14').setNumberFormat(decimal);summary.getRange('E14').setNumberFormat(money);
summary.getRange('A13:F14').format.fill=light;summary.getRange('A13:F14').format.rowHeight=34;
summary.getRange('A13:F14').format.wrapText=true;

section(summary,17,'수선 항목의 투자비 회수에 필요한 최소 회피비용');
put(summary,'A18','검토기간');put(summary,'B18',3);put(summary,'C18','년, 비교를 위한 작성 가정');
summary.getRange('B18').format={fill:'#FFF2CC',font:{name:'Malgun Gothic',size:11,color:blue}};
summary.getRange('B18').setNumberFormat('0');
summary.getRange('B18').dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:20}};
put(summary,'A19','아래는 절감 전망이 아닌 회수 기준. 수명·잔존가치·할인·추가운영비 미반영. 실제 평가기간으로 변경.');
summary.getRange('A19:F19').format.font={name:'Malgun Gothic',size:10,italic:true,color:gray};
header(summary,21,['2027 수선 항목','예산','필요 연평균 순회피비용','단위','미실행 시 비용 항목','확정에 필요한 최소 자료']);
const requirements=[
 [8,'SD·MSD 송풍기 팬 보수','긴급수리·정지 복구 추가비','신품/보수 동등기간 비용과 원인별 정지시간.'],
 [9,'고압노즐밸브 교체','누유·재가공·폐기·정지 추가비','실제 누유량, 폐기/재가공량, 단위원가, 정지기록.'],
 [10,'균질기 PLC·예비품','불필요 정지·긴급조달 추가비','인터록 유지 범위, 예방가능시간, 예비품별 조달기간.'],
 [11,'무중력혼합기 오버홀','원료누설·긴급수리·정지 추가비','실측 누설량/원가, 신품/보수의 동일기간 총비용.'],
 [12,'폭기조 덮개·지지대','반복보수·재시공 추가비','부식/구조진단, 면적, 재질별 수명, 동등범위 견적.'],
 [13,'여과집진시설 부분보수','반복정비·교체 추가비','필터·실링 견적, 집진성능, 신품/부분보수 동등기간 비교.'],
 [14,'외벽 방수','누수 폐기·임시보수 추가비','최근 누수로 버린 원료/포장재 원가와 임시보수비.']
];
requirements.forEach((x,i)=>{
 const r=22+i,src=89+x[0];summary.getRange(`A${r}:F${r}`).values=[[x[1],null,null,'만원/년',x[2],x[3]]];
 form(summary,`B${r}`,`='단건산정'!B${src}/10000`);
 form(summary,`C${r}`,`=IF($B$18>0,B${r}/$B$18,"기간 확인")`);
 summary.getRange(`A${r}:F${r}`).format.wrapText=true;summary.getRange(`A${r}:F${r}`).format.rowHeight=52;
 if(i%2===1)summary.getRange(`A${r}:F${r}`).format.fill='#F4F7FA';
});
summary.getRange('B22:C28').setNumberFormat(decimal);
put(summary,'A30','정지손실의 계산 범위');
put(summary,'A31','회복 불가능한 공헌이익 손실과 실제 초과근무·외주·폐기 등 증분비용을 사용. 매출액과 평상시 고정급여의 중복 계산 제외.');
put(summary,'A33','기간·성격이 다른 금액을 더한 총절감액은 제시하지 않음. 2027 실제 현금절감은 단건산정의 확인 입력으로 계산.');
summary.getRange('A30:F33').format.font={name:'Malgun Gothic',size:10,color:gray};
summary.tabColor=ink;

wb.recalculate();
const checks={summary:summary.getRange('A6:F14').values,thresholds:summary.getRange('A22:D28').values,formulaOutputs:{dryer:calc.getRange('B9:B18').values,lift:calc.getRange('B27:B32').values,auto:calc.getRange('B39:B47').values,plc:calc.getRange('B51:B60').values,repair:calc.getRange('B64:B71').values,sale:calc.getRange('B75:B84').values}};
await fs.writeFile(path.join(root,'_work','quantified_values.json'),JSON.stringify(checks,null,2));
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},maxChars:1800})).ndjson);
for(const [sheetName,range,name] of [['투자효과비교','A1:F14','comparison'],['투자효과비교','A17:F33','thresholds'],['단건산정','A5:E23','dryer'],['단건산정','A26:E47','lift_auto'],['단건산정','A50:E71','failures'],['단건산정','A74:E105','disposal_budgets']]){
 const preview=await wb.render({sheetName,range,scale:1.25,format:'png'});
 await fs.writeFile(path.join(root,'_work',`quantified_${name}.png`),new Uint8Array(await preview.arrayBuffer()));
}
const target=path.join(dir,'2027_투자효과_미실행손실_정량보강.xlsx');
await(await SpreadsheetFile.exportXlsx(wb)).save(target);
console.log(JSON.stringify({file:target,worksheets:2,comparisonCases:6,recoveryThresholds:7}));
