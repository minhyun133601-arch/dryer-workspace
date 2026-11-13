"""Transcribe visible P&ID symbols and route geometry without inventing small labels."""
import json
from pathlib import Path
from collections import Counter

WORK=Path(__file__).resolve().parent.parent
OUT=Path(__file__).resolve().parent
W,H=1160,786
C=[]
E=[]

def node(id,name,type,system,x,y,tag=None,bbox=None,specs=None,confidence='confirmed',note='',rawLabel=None):
    if bbox is None: bbox=[x-8,y-8,16,16]
    c={'id':id,'tag':tag,'name':name,'type':type,'system':system,'rawSpecs':specs or {},
       'sourcePosition':{'x':round(x/W,6),'y':round(y/H,6),'bbox':[round(bbox[0]/W,6),round(bbox[1]/H,6),round(bbox[2]/W,6),round(bbox[3]/H,6)]},
       'sourcePixel':[x,y],'confidence':confidence,'confidenceNote':note,
       'sourceLocator':'열교환기 설치도.pptx 2쪽 삽입 P&ID image3.png'}
    if rawLabel is not None:c['rawLabel']=rawLabel
    C.append(c)
    return id

def edge(id,fr,to,kind,pts,confidence='visual-trace',note='',color='black',direction='unconfirmed'):
    E.append({'id':id,'from':fr,'to':to,'source':fr,'target':to,'kind':kind,'system':kind,
              'routePoints':[[round(x/W,6),round(y/H,6)] for x,y in pts],
              'routePixels':pts,'confidence':confidence,'note':note,'sourceColor':color,
              'flowDirection':direction})

def sensor(id,prefix,x,y,host,anchor=None,note='',confidence='visual-trace'):
    node(id,('계장 '+prefix) if prefix else '계장 원형기호(문자 미판독)','instrument','instrument',x,y,
         tag=None,bbox=[x-7,y-7,14,14],rawLabel=(prefix+' / 번호 미판독') if prefix else '문자·번호 미판독',
         confidence=confidence,note=note or '계장 기호는 보존하되 작은 숫자 태그는 원문 해상도에서 판독되지 않음')
    target=next(c for c in C if c['id']==host)
    tx,ty=anchor or target['sourcePixel']
    edge(id+'-link',id,host,'instrument',[[x,y+7],[x,ty],[tx,ty]],confidence=confidence,
         note='계장 접속/관계선 재현. 신호 형식·제어 로직은 확정하지 않음')

def inline_valve(id,name,x,y,system,routeId=None,raw=None,type='valve',confidence='visual-trace'):
    node(id,name,type,system,x,y,tag=None,bbox=[x-5,y-5,10,10],confidence=confidence,
         note='원문 밸브 기호 위치를 보존. 밸브 종류·번호 일부는 미판독',rawLabel=raw or '밸브기호 / 태그 미판독')
    C[-1]['inlineOnConnection']=routeId
    for e in E:
        if e['id']==routeId:e.setdefault('inlineComponents',[]).append(id)

# Main process geometry. Coordinates preserve source placement, not a physical survey.
node('dryer','건조 챔버','dryer','drying',366,324,bbox=[310,235,118,200],specs={'label':'DRYING CHAMBER','features':['상부 분사노즐 4개','측면 AIR SWEEP DOOR','EXPLOSION DOOR','콘 하부 배출']})
node('dryer_air_cap','건조기 상부 급기 캡','plenum','supplyAir',365,226,bbox=[336,213,63,24])
node('feed_manifold','상부 원료 분배 헤더','manifold','productLiquid',350,143,bbox=[323,125,59,27],confidence='visual-trace',note='원료 분기와 노즐은 보이나 소문자 계장번호는 해상도 부족')
for n,x in enumerate([343,358,373,387],1):node(f'atomizer{n}',f'상부 분사노즐 {n}','nozzle','productLiquid',x,185,bbox=[x-4,178,8,10],confidence='visual-trace')
node('air_sweep_door','AIR SWEEP DOOR','door','drying',335,278,bbox=[324,267,25,28])
node('explosion_door','EXPLOSION DOOR','door','drying',396,320,bbox=[383,304,24,32])
node('vibro_fluidizer','VIBRO FLUIDIZER','fluidBed','productSolid',423,474,tag='M100',bbox=[333,460,177,35],specs={'power':'2.2 kW','source':'하단 기기표 M100 VF'})
node('sieve1','제품 배출 SIEVE A','sieve','productSolid',513,510,tag='M101 A/B',bbox=[493,492,45,22],specs={'power':'0.6 kW','quantity':'2 EA','source':'기기표 M101 A,B SIEVE'},note='원문은 A/B 쌍을 표기하며 개별 기호의 A/B는 분리 판독되지 않음')
node('sieve2','제품 배출 후단 진동부','sieve','productSolid',537,532,tag='M102 A/B',bbox=[526,512,17,35],specs={'power':'0.6 kW','quantity':'2 EA','rawName':'VIBRO SUITE'},confidence='visual-trace',note='후단 연결 일부가 작은 기호로 표현됨; 개별 A/B 위치 미확정')
node('cyclone_top_header','사이클론 상부 배기 헤더','header','exhaust',721,165,bbox=[666,161,125,8])
node('cyclone_inlet_header','사이클론 측면 공통 유입선','header','exhaust',721,219,bbox=[624,216,144,8])
for n,x in enumerate([678,720,764],1):
    node(f'cyclone{n}',f'CYCLONE {n}','cyclone','exhaust',x,211,bbox=[x-18,160,36,92],note='병렬 3기; 원문 개별 장치 태그는 판독되지 않음')
node('cyclone_bottom_header','사이클론 하부 분말 집합부','screwConveyor','productSolid',719,274,tag='M103 A/B',bbox=[665,269,115,15],confidence='visual-trace',note='기기 아래 M103 A,B로 보이는 표기는 숫자 3 부분 판독 주의')
node('v100','분말 BLOW-THROUGH VALVE','rotaryValve','productSolid',677,318,tag='V100',bbox=[668,308,17,22],specs={'power':'0.75 kW','source':'하단 기기표 V100 BLOW-THROUGH VALVE'})
node('powder_injector','분말 반송 인젝터/합류부','injector','powderReturn',644,328,bbox=[631,318,24,18],confidence='visual-trace',note='밸브 왼쪽 접속 기호; 명칭·세부 태그 미확정')
node('hx','폐열회수 열교환기','heatExchanger','heatRecovery',937,249,bbox=[904,181,64,132],note='녹색 추가 계통. 원문 장치 태그는 보이지 않음')
node('hx_cold_filter','열교환기 외기 유입 필터','filter','supplyAir',884,264,bbox=[872,252,25,21],confidence='visual-trace')
node('wet_scrubber','WET SCRUBBER','wetScrubber','exhaust',1080,254,bbox=[1049,205,66,84])
node('scrubber_stack','습식집진기 상부 배기 스택','stack','exhaust',1087,151,bbox=[1082,101,10,107],confidence='visual-trace')
node('scrubber_tank','WET SCRUBBER TANK','tank','scrubberWater',1099,402,bbox=[1066,379,66,51])
node('waste_tank','WASTE TANK','tank','drain',1105,495,bbox=[1074,480,63,25])
node('hotwater_tank','HOT WATER TANK','tank','hotWater',844,488,tag='TK-300?',bbox=[822,451,46,68],confidence='visual-trace',note='원문 태그는 TK-3?0로 보이며 정확한 숫자는 확정하지 않음',rawLabel='TK-3?0 HOT WATER TANK')
node('water_tank','WATER TANK','tank','water',1034,570,tag='TK-3?0',bbox=[1011,543,48,56],confidence='visual-trace',note='원문 TK-3?0 숫자부분 미확정',rawLabel='TK-3?0 WATER TANK')
node('hotwater_heater','원료/열수 열교환기','heatExchanger','productLiquid',807,625,tag='B100?',bbox=[788,606,35,39],confidence='visual-trace',note='원문 B100로 보이나 문자·숫자 일부 불명확. 제품선/분홍 열수선이 교차 열교환하는 기호')
node('process_strainers','병렬 2열 원료 스트레이너','filterBank','productLiquid',930,626,bbox=[898,604,65,49],confidence='visual-trace',note='병렬 2기 및 각 입·출구 수동밸브가 보임. 별도 장치명·태그 미표기')
node('homogenizer','HOMOGENIZER / HIGH PRESSURE PUMP','homogenizer','productLiquid',681,585,tag='P201',bbox=[660,574,25,27],confidence='visual-trace',note='P201 본체와 고압 조절블록은 원문 프레임 내부')
node('homogenizer_valveblock','균질기 고압 조절 블록','controlBlock','productLiquid',624,585,bbox=[604,571,43,27],confidence='visual-trace')
node('oil_pump','균질기 오일 펌프','pump','oil',681,606,tag='P300',bbox=[672,598,18,18],specs={'power':'0.?5 kW','source':'기기표 HOMOGENIZER OIL PUMP','note':'소수 첫째 자리 이미지 판독불가'},confidence='visual-trace')
node('hotwater_loop_pump','열수 순환 펌프','pump','hotWater',814,528,bbox=[806,519,17,18],confidence='visual-trace',note='태그는 P?00로 보임; 기기표 P100 습식집진기 펌프와 합치지 않음')
node('hotwater_distribution_pump','열수 분배 펌프','pump','hotWater',916,529,bbox=[907,520,18,18],confidence='visual-trace',note='태그 P?10로 보이나 숫자 확정 불가')

# Fans and pumps whose tags or table names can be read.
fan_data=[
 ('c100','NOZZLE COOLING FAN',190,180,{'power':'11 kW','pressure':'500 mmWG','capacity':'3500 KG/H'},'confirmed'),
 ('c101','DISPERSER COOLING FAN',428,199,{'power':'1.5 kW','pressure':'150 mmWG','capacity':'500? KG/H','capacityNote':'기기표 작은 숫자 판독 주의'},'confirmed'),
 ('c102','EXHAUST FAN',817,166,{'power':'220 kW','pressure':'5?0 mmWG','capacity':'93000 KG/H','pressureNote':'중간 숫자 판독 불가; 신규 견적500mmWG와 혼용하지 않음'},'confirmed'),
 ('c103','SUPPLY FAN',215,346,{'power':'76 kW','pressure':'2?0 mmWG','capacity':'55000 KG/H','pressureNote':'중간 숫자 판독 불가'},'confirmed'),
 ('c104','VF FAN SECTION A',193,474,{'power':'7.5 kW','pressure':'300 mmWG','capacity':'4000 KG/H'},'confirmed'),
 ('c106','VF FAN SECTION B',258,530,{'power':'11 kW','pressure':'280 mmWG','capacity':'7000 KG/H'},'visual-trace'),
 ('c108','하부 유동층 보조 송풍기',259,583,{'note':'원문 그림에 C108로 보이나 하단 기기표에 별도 사양 없음'},'visual-trace'),
 ('c109','하부 유동층 보조 송풍기',235,628,{'note':'원문 그림에 C109로 보이나 하단 기기표에 별도 사양 없음'},'visual-trace'),
 ('c300','균질기 BLOWOUT FAN',656,570,{'power':'5.5 kW','source':'기기표 C300 BLOWOUT FAN'},'visual-trace'),
 ('c301','균질기 보조 팬',585,540,{'rawNote':'원문 C301 및 FAN 표기, 정격 미표기'},'visual-trace')]
for id,name,x,y,spec,conf in fan_data:node(id,name,'fan','exhaust' if id=='c102' else 'instrumentCooling' if id in ['c100','c101','c300','c301'] else 'supplyAir',x,y,tag=id.upper(),specs=spec,confidence=conf,bbox=[x-7,y-7,14,14])
node('l100','FINE RETURN BLOWER','blower','powderReturn',754,330,tag='L100',specs={'power':'18.5 kW','pressure':'0.3 bar','capacity':'12.? m³/min','speed':'1150 RPM','capacityNote':'마지막 소수자리 원문 불명확'},confidence='visual-trace')
node('p100','WET SCRUBBER PUMP','pump','scrubberWater',1093,448,tag='P100',specs={'power':'15 kW','pressure':'3 bar','capacity':'90 m³/h'})
node('p101','TRANSFER PUMP','pump','productLiquid',983,626,tag='P101',specs={'power':'3.7 kW','pressure':'4 bar','capacity':'9 m³/h'})
node('fuel_burner','가스 버너 / MAIN BURNER','burner','hotAir',215,300,bbox=[183,288,45,22],note='LNG/LPG 겸용은 PPT 본문 설명; 원문 P&ID에는 MAIN BURNER 표기')
node('heater_a','유동층 A 공기 가열 코일','heater','hotAir',238,474,tag='H0?0',bbox=[220,460,29,28],confidence='visual-trace',note='코일 위 TV 제어밸브와 응축/배수 하단 기호가 보임')
node('heater_b','유동층 B 공기 가열 코일','heater','hotAir',302,531,tag='H?01',bbox=[287,514,31,32],confidence='visual-trace')
node('heater_cooling_c','하부 공기 냉각 코일','cooler','coldAir',286,628,tag='H0?3',bbox=[274,612,26,30],confidence='visual-trace')
node('heater_d','하부 공기 가열 코일','heater','hotAir',319,628,tag='H?03',bbox=[302,612,34,30],confidence='visual-trace')
node('dosing_system','DOSING SYSTEM','dosing','additive',694,421,bbox=[670,397,49,32],confidence='confirmed')
node('hoist1','HOIST.1','hoist','mechanical',1117,78,bbox=[1108,67,18,22],confidence='visual-trace',note='원문 우상단 호이스트 기호와 HOIST.1 라벨. 접두 태그 문자가 불명확하여 tag를 비움',rawLabel='?300 HOIST.1')
node('hoist2','HOIST.2','hoist','mechanical',1148,78,bbox=[1139,67,18,22],confidence='visual-trace',note='원문 우상단 호이스트 기호와 HOIST.2 라벨. 접두 태그 문자가 불명확하여 tag를 비움',rawLabel='?301 HOIST.2')

# Source boundaries are explicit nodes so uncertain off-sheet destinations stay visible.
for id,name,typ,sys,x,y in [
 ('cip_supply','CIP SUPPLY 경계','boundary','cip',1019,117),('hx_drain','열교환기 하부 배출 경계','boundary','drain',936,369),
 ('exhaust_out','배기 대기 경계','boundary','exhaust',1087,100),('water_makeup','급수 경계','boundary','water',1140,386),
 ('scrubber_drain','습식집진기 배수 경계','boundary','drain',1101,476),('waste_drain','WASTE TANK 배출 경계','boundary','drain',1105,530),
 ('feed_inlet','원료 유입 경계','boundary','productLiquid',1041,626),('product_out','분말제품 배출 경계','boundary','productSolid',541,554),
 ('feed_return','RETURN 경계','boundary','productLiquid',77,126),('steam_in','증기 공급 경계','boundary','steam',798,458),
 ('water_in','WATER 경계','boundary','water',1066,550),('hotwater_out1','열수 분배 경계1','boundary','hotWater',980,504),
 ('hotwater_out2','열수 분배 경계2','boundary','hotWater',980,513),('hotwater_out3','열수 분배 경계3','boundary','hotWater',980,521),
 ('hotwater_out4','열수 분배 경계4','boundary','hotWater',980,530),('pressure_air','분무/계장 AIR 경계','boundary','instrumentAir',303,270)]:node(id,name,typ,sys,x,y,confidence='visual-trace')

# Confirmed component relationships; line directions are not inferred from layout alone.
edge('nozzle-air','c100','dryer_air_cap','coolingAir',[[190,180],[330,180],[342,214]],note='분사부 상부 냉각 공기선')
edge('disperser-air','c101','dryer_air_cap','coolingAir',[[428,199],[418,199],[418,224],[398,224]],note='상부 캡 우측 접속선')
edge('main-air-burner','c103','fuel_burner','supplyAir',[[215,346],[215,311]],direction='from-to')
edge('burner-hot-air','fuel_burner','dryer_air_cap','hotAir',[[215,288],[215,225],[337,225]],note='원문 Ø1250로 보이는 주 급기 덕트; 치수 판독확정 아님')
edge('cap-dryer','dryer_air_cap','dryer','hotAir',[[366,237],[366,250]],note='상부 급기 캡과 건조챔버 연결')
for n,x in enumerate([343,358,373,387],1):
    edge(f'nozzle-feed-{n}','feed_manifold',f'atomizer{n}','productLiquid',[[324,88+n*11],[x,88+n*11],[x,181]],note='4개 노즐 분기 형태를 보존; 개별 노즐 태그 판독 불가')
    edge(f'nozzle-spray-{n}',f'atomizer{n}','dryer','productLiquid',[[x,186],[x,208]],confidence='visual-trace',note='분사방향 개념 연결, 실제 분무 궤적을 뜻하지 않음')
edge('dryer-exhaust','dryer','cyclone_inlet_header','exhaust',[[411,398],[622,398],[622,219],[662,219]],confidence='uncertain',note='챔버/외곽 덕트선이 겹쳐 취출 포트 위치는 불명확. 오른쪽 하부 공통덕트와 사이클론 측면 헤더의 연결을 추적한 선')
for n,x in enumerate([678,720,764],1):
    edge(f'cyclone-in-{n}','cyclone_inlet_header',f'cyclone{n}','exhaust',[[x,219],[x,214]],confidence='visual-trace',note='3기 공통 측면 헤더')
    edge(f'cyclone-air-out-{n}',f'cyclone{n}','cyclone_top_header','exhaust',[[x,160],[x,165]],confidence='visual-trace')
    edge(f'cyclone-solid-{n}',f'cyclone{n}','cyclone_bottom_header','productSolid',[[x,251],[x,273]],confidence='confirmed')
edge('cyclone-fan','cyclone_top_header','c102','exhaust',[[678,165],[791,165],[817,165]],confidence='confirmed')
edge('fan-hx','c102','hx','exhaust',[[825,166],[934,166],[934,183]],confidence='confirmed',color='green',direction='from-to')
edge('hx-wet','hx','wet_scrubber','exhaust',[[938,311],[1007,311],[1007,204],[1042,204],[1042,235],[1052,243]],confidence='visual-trace',color='green',note='도면의 녹색 배기측 연결을 따라 추적. 열교환기 내부 실제 채널은 도면 부호만 보존')
edge('scrubber-stack','wet_scrubber','scrubber_stack','exhaust',[[1087,207],[1087,151]],confidence='confirmed')
edge('stack-out','scrubber_stack','exhaust_out','exhaust',[[1087,151],[1087,100]],confidence='confirmed')
edge('ambient-hx','hx_cold_filter','hx','supplyAir',[[884,264],[907,264]],confidence='confirmed',color='green')
edge('recovered-air-main','hx','c103','supplyAir',[[905,219],[850,219],[850,65],[134,65],[134,375],[215,375],[215,354]],confidence='confirmed',color='green',note='PPT2 원문 설명: 5층 열교환기에서 4층 송풍기 투입. 도면의 녹색 외곽 연결선 그대로 추적',direction='from-to')
edge('hx-drain','hx','hx_drain','drain',[[936,311],[936,345],[936,369]],confidence='confirmed',color='green')
edge('dryer-solid','dryer','vibro_fluidizer','productSolid',[[358,434],[358,463]],confidence='confirmed')
edge('bed-sieve','vibro_fluidizer','sieve1','productSolid',[[506,490],[508,502]],confidence='confirmed')
edge('sieve-pair','sieve1','sieve2','productSolid',[[528,516],[535,524]],confidence='visual-trace',note='후단 기호가 작아 개별 기기 A/B 관계는 미확정')
edge('sieve-out','sieve2','product_out','productSolid',[[539,539],[541,554]],confidence='visual-trace')
edge('powder-header-valve','cyclone_bottom_header','v100','productSolid',[[678,284],[678,309]],confidence='confirmed')
edge('valve-return','v100','powder_injector','powderReturn',[[678,324],[644,328]],confidence='visual-trace')
edge('blower-return','l100','powder_injector','powderReturn',[[754,330],[644,330]],confidence='confirmed',direction='from-to')
edge('powder-bed-return','powder_injector','vibro_fluidizer','powderReturn',[[644,328],[536,388],[536,455],[499,465]],confidence='uncertain',note='반송선의 굴곡·교차가 보이나 챔버/배기덕트 외곽선과 겹치는 부분은 구분 불가')
for id,coil,port,pts in [
 ('vf-air-a','heater_a',0,[[193,474],[223,474]]),('vf-air-b','heater_b',0,[[258,530],[288,530]]),
 ('vf-air-c',None,0,[[259,583],[460,583],[460,496]]),('vf-air-d','heater_cooling_c',0,[[235,628],[274,628]])]:
    fan={'vf-air-a':'c104','vf-air-b':'c106','vf-air-c':'c108','vf-air-d':'c109'}[id]
    edge(id,fan,coil or 'vibro_fluidizer','supplyAir',pts,confidence='confirmed')
edge('vf-heat-a','heater_a','vibro_fluidizer','hotAir',[[249,474],[331,474],[331,490],[345,490]],confidence='confirmed')
edge('vf-heat-b','heater_b','vibro_fluidizer','hotAir',[[318,531],[423,531],[423,495]],confidence='confirmed')
edge('vf-cool-d','heater_cooling_c','heater_d','coldAir',[[300,628],[304,628]],confidence='confirmed')
edge('vf-heat-d','heater_d','vibro_fluidizer','hotAir',[[336,628],[491,628],[491,493]],confidence='confirmed')
edge('dosing-bed','dosing_system','vibro_fluidizer','additive',[[694,421],[442,421],[442,463]],confidence='visual-trace',color='orange')

# Wet scrubber water and drains.
edge('scrubber-water-pump','scrubber_tank','p100','scrubberWater',[[1100,430],[1100,448],[1093,448]],confidence='confirmed',color='cyan')
edge('scrubber-water-riser','p100','wet_scrubber','scrubberWater',[[1085,448],[1037,448],[1037,238],[1047,238]],confidence='visual-trace',color='cyan')
edge('scrubber-water-return','wet_scrubber','scrubber_tank','scrubberWater',[[1091,285],[1091,311],[1100,317],[1100,380]],confidence='visual-trace',color='cyan')
edge('scrubber-water-makeup','water_makeup','scrubber_tank','water',[[1140,386],[1129,386]],confidence='confirmed',color='cyan')
edge('scrubber-tank-drain','scrubber_tank','scrubber_drain','drain',[[1101,430],[1101,476]],confidence='confirmed',color='cyan')
edge('scrubber-waste','scrubber_drain','waste_tank','drain',[[1101,476],[1105,482]],confidence='visual-trace',color='cyan')
edge('waste-out','waste_tank','waste_drain','drain',[[1105,505],[1105,530]],confidence='confirmed',color='cyan')

# Feed/heater/homogenizer loop. Flow direction not asserted where arrowheads are unreadable.
edge('feed-transfer','feed_inlet','p101','productLiquid',[[1041,626],[983,626]],confidence='confirmed')
edge('transfer-strainers','p101','process_strainers','productLiquid',[[974,626],[963,626],[963,610],[931,610]],confidence='confirmed',note='병렬 상·하 2개 여과열의 합류')
edge('strainers-heater','process_strainers','hotwater_heater','productLiquid',[[930,610],[900,610],[900,626],[823,626]],confidence='confirmed')
edge('water-feed','water_tank','p101','water',[[1034,599],[1034,626],[995,626]],confidence='confirmed',color='cyan',note='급수탱크 하부가 제품선 펌프 우측으로 접속')
edge('water-tank-in','water_in','water_tank','water',[[1066,550],[1056,550]],confidence='confirmed',color='cyan')
edge('heater-hp','hotwater_heater','homogenizer','productLiquid',[[788,626],[748,626],[748,585],[683,585]],confidence='confirmed')
edge('hp-valves','homogenizer','homogenizer_valveblock','productLiquid',[[672,585],[646,585]],confidence='confirmed')
edge('hp-nozzle-header','homogenizer_valveblock','feed_manifold','productLiquid',[[605,585],[529,585],[529,655],[104,655],[104,126],[324,126]],confidence='uncertain',note='원문 외곽 검은 배관을 추적. 상부 RETURN 및 4분기 접속점에서 방향과 정확한 배관 구분 미확정')
edge('return-boundary','feed_manifold','feed_return','productLiquid',[[324,126],[77,126]],confidence='confirmed',note='원문 RETURN 라벨')
edge('homogenizer-oil','oil_pump','homogenizer','oil',[[681,606],[681,594]],confidence='visual-trace')
edge('oil-return','homogenizer','oil_pump','oil',[[686,589],[699,597],[699,610],[690,610]],confidence='visual-trace',note='오일분기·부속부 기호 보이나 상세 라벨 미확정')
edge('cooling-hp','c300','homogenizer','coolingAir',[[656,570],[668,570],[677,583]],confidence='visual-trace',note='기기표 BLOWOUT FAN; 실제 공기측 접속범위는 도면 소형 부호로만 보존')

# Hot water heating loop and utility distribution.
edge('hotwater-tank-loop','hotwater_tank','hotwater_loop_pump','hotWater',[[844,519],[844,528],[814,528]],confidence='confirmed',color='magenta')
edge('hotwater-loop-heater','hotwater_loop_pump','hotwater_heater','hotWater',[[805,528],[800,528],[800,644]],confidence='confirmed',color='magenta')
edge('hotwater-heater-return','hotwater_heater','hotwater_tank','hotWater',[[805,644],[817,644],[817,550],[885,550],[885,454],[839,454],[839,477]],confidence='visual-trace',color='magenta')
edge('hotwater-distribution','hotwater_tank','hotwater_distribution_pump','hotWater',[[844,519],[869,519],[869,529],[916,529]],confidence='visual-trace',color='magenta')
for n,y in enumerate([504,513,521,530],1):edge(f'hotwater-branch-{n}','hotwater_distribution_pump',f'hotwater_out{n}','hotWater',[[924,529],[943,529],[943,y],[980,y]],confidence='confirmed',color='magenta')
edge('hotwater-steam-control','steam_in','hotwater_tank','steam',[[798,458],[798,478],[831,478]],confidence='visual-trace',color='magenta',note='원문 SC 유틸리티 라벨로 보이며 유체 약어 확정 불가; 온도제어밸브는 보존')
edge('door-air-service','pressure_air','air_sweep_door','instrumentAir',[[303,270],[303,290],[315,290]],confidence='visual-trace',note='AIR 표기와 도어측 소형 에어 접속관계. 액추에이터 동작·압력은 미확정')

# Do not promote blurred tag/pressure digits into engineering specifications.
for c in C:
    if c['id']=='oil_pump':
        c['tag']=None;c['rawLabel']='P?00 HOMOGENIZER OIL PUMP';c['rawSpecs']['power']=None
        c['rawSpecs']['unreadablePower']='0.?5 kW';c['confidence']='uncertain'
        c['confidenceNote']='P200/P300 숫자 판독 불가. 원문 명칭 HOMOGENIZER OIL PUMP를 보존하고 제품이송펌프와 분리.'
    if c['id'] in ['c300','c301']:
        c['rawLabel']='C?00 BLOWOUT FAN' if c['id']=='c300' else 'C?01 CABINET FAN?'
        c['tag']=None;c['confidence']='uncertain';c['confidenceNote']='C200/C300 또는 C201/C301 숫자 판독 불가. 명칭과 원문 위치를 보존.'
    if c['id'] in ['c101','c102','c103','l100']:
        for k,v in list(c['rawSpecs'].items()):
            if isinstance(v,str) and '?' in v and k in ['pressure','capacity']:
                c['rawSpecs']['unreadable_'+k]=v;c['rawSpecs'][k]=None
    if c['id']=='steam_in':
        c['name']='열수 가열 유틸리티 경계';c['system']='heatingUtility';c['rawLabel']='SC? / 유체명 미판독'
for e in E:
    if e['id']=='hotwater-steam-control':e['kind']=e['system']='heatingUtility'

# Seven inlet filter symbols are explicit in the P&ID.
for id,x,y,fan,route in [
 ('filter-c100',159,180,'c100','nozzle-air'),('filter-c101',455,199,'c101','disperser-air'),
 ('filter-c104',164,474,'c104','vf-air-a'),('filter-c106',230,530,'c106','vf-air-b'),
 ('filter-c108',231,583,'c108','vf-air-c'),('filter-c109',207,628,'c109','vf-air-d'),
 ('filter-l100',780,330,'l100','blower-return')]:
    node(id,'송풍기 입구 필터','filter','supplyAir' if fan!='l100' else 'powderReturn',x,y,bbox=[x-9,y-6,18,12])
    edge(id+'-fan',id,fan,'supplyAir' if fan!='l100' else 'powderReturn',[[x,y],next(c for c in C if c['id']==fan)['sourcePixel']],confidence='confirmed')

# CIP is a separate service network. Source circles represent its contact points.
node('cip_upper_header','CIP 상부 분기 헤더','header','cip',910,100,bbox=[814,96,200,8],note='원문 CIP SUPPLY에서 상·하 두 밸브 분기가 보임')
node('cip_lower_header','CIP 열교환기 분기 헤더','header','cip',942,117,bbox=[915,113,100,8])
edge('cip-supply-upper','cip_supply','cip_upper_header','cip',[[1019,117],[1014,117],[1014,100],[814,100]],confidence='confirmed',color='green')
edge('cip-supply-lower','cip_supply','cip_lower_header','cip',[[1019,117],[915,117]],confidence='confirmed',color='green')
for n,(x,y,host) in enumerate([(814,158,'c102'),(825,158,'c102'),(872,158,'fan-hx'),(884,158,'fan-hx'),(896,158,'fan-hx')],1):
    node(f'cip_duct_port{n}',f'CIP 덕트 접속점 {n}','sprayPort','cip',x,y,bbox=[x-3,y-3,6,6],confidence='visual-trace',note='원문 CIP 분기관 끝의 원형기호. 노즐 모델·개수 사양 확정값은 아님')
    edge(f'cip-duct-{n}','cip_upper_header',f'cip_duct_port{n}','cip',[[x,100],[x,y]],confidence='confirmed',color='green')
for n,x in enumerate([919,932,945,959],1):
    node(f'cip_hx_port{n}',f'CIP 열교환기 상부 접속점 {n}','sprayPort','cip',x,184,bbox=[x-3,181,6,6],confidence='visual-trace')
    edge(f'cip-hx-{n}','cip_lower_header',f'cip_hx_port{n}','cip',[[x,117],[x,184]],confidence='confirmed',color='green')

# Main return/feed valves and three cyclone cone service valves.
inline_valve('return-valve','RETURN 제어밸브',94,126,'productLiquid','return-boundary',raw='Y?01 / 1/2B')
for n,y in enumerate([88,100,113,126],1):inline_valve(f'feed-branch-valve{n}',f'분사노즐 분기 밸브 {n}',254,y,'productLiquid',f'nozzle-feed-{n}',raw='X3?0 / 1/2B')
inline_valve('c100-damper','노즐 냉각공기 조절기호',177,180,'coolingAir','nozzle-air')
inline_valve('c101-damper','디스퍼서 냉각공기 조절기호',444,199,'coolingAir','disperser-air')
inline_valve('c102-damper','사이클론 배기선 조절밸브',793,165,'exhaust','cyclone-fan',raw='FV-C?00')
for n,x in enumerate([663,705,748],1):
    inline_valve(f'cyclone-cone-valve{n}',f'사이클론 {n} 콘부 보조밸브',x,242,'utility',raw='RC / AIR?')
    sensor(f'cyclone-cone-indication{n}','RC?',x-8,257,f'cyclone{n}',anchor=[x,235],confidence='uncertain')
inline_valve('cip-upper-valve','CIP 상부 공급밸브',997,100,'cip','cip-supply-upper')
inline_valve('cip-lower-valve','CIP 하부 공급밸브',997,117,'cip','cip-supply-lower')
inline_valve('hx-drain-valve','열교환기 드레인 밸브',936,344,'drain','hx-drain')
inline_valve('scrubber-makeup-valve','습식집진기 탱크 보충수 밸브',1130,386,'water','scrubber-water-makeup',raw='RC 300?')
inline_valve('scrubber-bottom-valve','습식집진기 탱크 배수밸브',1100,441,'drain','scrubber-tank-drain')
inline_valve('scrubber-pump-discharge-valve','습식집진기 펌프 토출밸브',1110,448,'scrubberWater','scrubber-water-pump')
inline_valve('scrubber-riser-valve','습식집진기 급수 라이저 밸브',1037,412,'scrubberWater','scrubber-water-riser')
inline_valve('hotwater-steam-valve','열수 가열유틸리티 제어밸브',798,478,'heatingUtility','hotwater-steam-control',raw='TV-300?')
inline_valve('hotwater-tank-valve','열수탱크 하부밸브',845,525,'hotWater','hotwater-tank-loop')
inline_valve('hotwater-makeup-valve','열수탱크 우측 보충수 밸브',868,473,'water',raw='RC 300?')
inline_valve('hotwater-heater-control','제품/열수 열교환기 유틸리티 제어밸브',800,596,'hotWater','hotwater-loop-heater',raw='TV-H?00')
for n,y in enumerate([504,513,521,530],1):inline_valve(f'hotwater-outlet-valve{n}',f'열수 분기 {n} 밸브',963,y,'hotWater',f'hotwater-branch-{n}')
inline_valve('water-tank-makeup-valve','원료 급수탱크 보충수 밸브',1057,550,'water','water-tank-in',raw='RC 300?')
inline_valve('water-tank-bottom-valve','원료 급수탱크 하부 밸브',1034,611,'water','water-feed',raw='V300?')
inline_valve('feed-inlet-valve','원료 유입 경계 밸브',1040,626,'productLiquid','feed-transfer',raw='Y0?0')
for n,(x,y) in enumerate([(903,611),(959,611),(903,643),(959,643)],1):inline_valve(f'strainer-valve{n}',f'병렬 여과열 격리밸브 {n}',x,y,'productLiquid','transfer-strainers')
for id,x,y,route,raw in [
 ('heater-a-control',239,448,'vf-heat-a','TV-E?00'),('heater-b-control',305,507,'vf-heat-b','TV-E?00'),
 ('heater-d-control',319,598,'vf-heat-d','TV-E?00'),('heater-cool-control',286,606,'vf-cool-d','냉각 유틸리티 밸브')]:
    inline_valve(id,'유동층 공기조화 유틸리티 제어밸브',x,y,'heatingUtility',route,raw=raw)

# Instrument bubbles and VFD-like diagonal controller symbols are individually retained.
for args in [
 ('feed-ls','LS',270,113,'feed_manifold',[324,113]),('feed-la','LA',290,113,'feed_manifold',[324,113]),
 ('nozzle-ls','LS',397,108,'feed_manifold',[382,144]),('nozzle-la','LA',418,108,'feed_manifold',[382,144]),
 ('burner-te','TE?',191,270,'fuel_burner',[191,289]),('burner-control','TC?',175,270,'fuel_burner',[185,289]),
 ('burner-pressure','PI?',196,323,'c103',[215,330]),('burner-fe','FE',233,324,'fuel_burner',[215,310]),('burner-ft','FT',250,324,'fuel_burner',[215,310]),
 ('chamber-measure1','PT?',435,279,'dryer',[427,279]),('chamber-measure2','PS?',435,312,'dryer',[427,312]),('chamber-measure3','P?',451,312,'dryer',[427,312]),
 ('chamber-sweep','RC?',294,294,'air_sweep_door',[315,294]),('chamber-cone-air','RC?',303,397,'dryer',[325,397]),
 ('chamber-door-ps','PS?',363,347,'explosion_door',[385,347]),('chamber-door-switch','QS?',380,347,'explosion_door',[385,347]),
 ('fluidizer-tt','TT?',444,434,'vibro_fluidizer',[444,463]),('fluidizer-te','TE?',458,434,'vibro_fluidizer',[458,463]),
 ('fluidizer-pt','PT?',465,414,'vibro_fluidizer',[465,463]),('fluidizer-cone-control','TV?',466,396,'vibro_fluidizer',[466,463]),
 ('a-te','TE',261,456,'heater_a',[261,474]),('a-tt','TT',280,456,'heater_a',[280,474]),('a-control','TC?',250,437,'heater_a',[239,448]),
 ('b-te','TE',327,514,'heater_b',[327,531]),('b-tt','TT',348,514,'heater_b',[348,531]),('b-control','TC?',321,495,'heater_b',[305,507]),
 ('c-te','TE',365,565,'c108',[365,583]),('c-tt','TT',384,565,'c108',[384,583]),
 ('d-te','TE',366,610,'heater_d',[366,628]),('d-tt','TT',387,610,'heater_d',[387,628]),('d-control','TC?',344,590,'heater_d',[319,598]),
 ('return-flow','FT?',722,313,'l100',[722,330]),('return-pressure','PI?',722,298,'l100',[722,330]),
 ('hx-hot-in-te','TE?',891,142,'hx',[891,166]),('hx-hot-in-ti','TI?',891,126,'hx',[891,166]),
 ('hx-hot-out-te','TE?',1007,142,'hx',[1007,204]),('hx-hot-out-ti','TI?',1007,126,'hx',[1007,204]),
 ('hx-recovered-te','TE?',839,49,'hx',[839,65]),('hx-recovered-ti','TI?',839,33,'hx',[839,65]),
 ('hx-filter-dp','P?',899,281,'hx_cold_filter',[899,264]),('c102-control','Q?',850,138,'c102',[817,166]),
 ('scrubber-level1','LS?',1070,363,'scrubber_tank',[1078,380]),('scrubber-level2','LS?',1070,376,'scrubber_tank',[1078,380]),('scrubber-pg','PG',1049,405,'p100',[1037,412]),
 ('hotwater-te','TE',821,478,'hotwater_tank',[833,478]),('hotwater-ts','TS',840,511,'hotwater_tank',[840,517]),('hotwater-rc','RC',868,461,'hotwater_tank',[868,473]),
 ('hw-pump-pg','PG',803,519,'hotwater_loop_pump',[803,528]),('hw-dist-pg','PG',932,519,'hotwater_distribution_pump',[932,529]),
 ('process-heater-tt','TT?',782,592,'hotwater_heater',[799,596]),('process-heater-te','TE?',782,612,'hotwater_heater',[795,625]),
 ('feed-pump-pg','PG',984,608,'p101',[984,626]),('water-tank-rc','RC',1058,532,'water_tank',[1058,550]),
 ('hp-ft1','FT?',607,561,'homogenizer_valveblock',[607,575]),('hp-ft2','FT?',625,561,'homogenizer_valveblock',[625,575]),('hp-ft3','FT?',644,561,'homogenizer_valveblock',[644,575]),
 ('hp-upper1','P?',607,545,'homogenizer_valveblock',[607,575]),('hp-upper2','P?',625,545,'homogenizer_valveblock',[625,575]),('hp-upper3','P?',644,545,'homogenizer_valveblock',[644,575]),
 ('hp-pressure1','P?',698,563,'homogenizer',[682,580]),('hp-pressure2','P?',717,563,'homogenizer',[682,580]),('hp-upper-temp','TS?',699,544,'homogenizer',[699,562]),
 ('hp-oil-fs','FS?',723,611,'oil_pump',[700,610]),('hp-oil-low','FS?',723,630,'oil_pump',[700,615]),('hp-oil-pg','PG?',655,608,'oil_pump',[671,606]),
 ('hp-blow-pressure1','PT?',589,600,'homogenizer_valveblock',[605,589]),('hp-blow-pressure2','PT?',589,616,'homogenizer_valveblock',[605,589])
]:
    sensor(*args)

for id,x,y,fan in [('drive-a',193,449,'c104'),('drive-b',258,503,'c106'),('drive-c',259,559,'c108'),('drive-d',235,604,'c109'),('drive-hp',682,560,'homogenizer')]:
    node(id,'대각선 제어/구동 기호','driveSymbol','instrument',x,y,bbox=[x-7,y-8,14,16],confidence='visual-trace',note='원문 대각선 사각기호를 보존. VFD 형식·제어 로직은 확정하지 않음')
    edge(id+'-link',id,fan,'instrument',[[x,y+8],[x,next(c for c in C if c['id']==fan)['sourcePixel'][1]]],confidence='visual-trace')

# Small branch valves, relief/utility stubs and mechanical features that should not disappear.
for id,x,y,name,host in [
 ('hp-relief',568,585,'균질기 원료선 상부 소형 밸브','homogenizer'),
 ('hp-oil-valve',704,619,'균질기 오일회로 소형밸브','oil_pump'),
 ('chamber-air-valve',304,308,'건조챔버 에어 보조밸브','dryer'),
 ('chamber-cone-valve',318,397,'챔버 콘부 에어 보조밸브','dryer')]:
    inline_valve(id,name,x,y,'utility');C[-1]['hostComponent']=host

for n,(x,y) in enumerate([(239,491),(305,549),(287,645),(319,645)],1):
    node(f'coil-drain-{n}',f'공기조화 코일 하부 드레인 기호 {n}','drainSymbol','utility',x,y,confidence='visual-trace',note='짧은 유틸리티 종단 및 문자 DR?가 보이나 유체·배수시스템 상세 미판독')

# Preserve visual borders as semantic groupings, not pipes.
GROUPS=[
 {'id':'homogenizer-group','name':'HOMOGENIZER / HIGH PRESSURE PUMP','bbox':[563/W,510/H,172/W,151/H],'sourceColor':'orange','members':['homogenizer','homogenizer_valveblock','oil_pump','c300','c301']},
 {'id':'dosing-group','name':'DOSING SYSTEM','bbox':[670/W,397/H,49/W,32/H],'sourceColor':'orange','members':['dosing_system']}
]

# Final coordinate/label review against the original raster and readable crops.
for c in C:
    if c['tag'] and '?' in c['tag']:
        c['rawTag']=c['tag'];c['tag']=None
    if c['id']=='c100-damper':c['inlineOnConnection']='filter-c100-fan'
    if c['id']=='c101-damper':c['inlineOnConnection']='filter-c101-fan'
    if c['id']=='scrubber-pump-discharge-valve':c['name']='습식집진기 펌프 배관 밸브'
    if c['id'].startswith('cip_hx_port'):c['hostComponent']='hx'
    if c['id'].startswith('cip_duct_port'):
        c['hostComponent']='c102' if c['id'].endswith(('1','2')) else 'hx'
        c['hostConnection']='fan-hx'
for c in C:
    if c['id'] in ['chamber-measure1','chamber-measure2','chamber-measure3']:
        x,y={'chamber-measure1':(435,261),'chamber-measure2':(435,283),'chamber-measure3':(451,283)}[c['id']]
        c['sourcePixel']=[x,y];c['sourcePosition']={'x':round(x/W,6),'y':round(y/H,6),'bbox':[round((x-7)/W,6),round((y-7)/H,6),round(14/W,6),round(14/H,6)]}
        for e in E:
            if e['id']==c['id']+'-link':
                e['routePixels']=[[x,y+7],[x,y],[427,y]]
                e['routePoints']=[[round(px/W,6),round(py/H,6)] for px,py in e['routePixels']]

sensor('chamber-pressure-control','PIC?',435,247,'dryer',anchor=[435,261],note='상부 원형 제어기호에서 황록색 선이 배기팬 입구 조절기호까지 연속됨. 번호·제어로직 미확정')
sensor('bed-pressure-control','P?C?',464,345,'vibro_fluidizer',anchor=[464,363],note='황록색 제어선의 시작 기호. 번호 미판독')
sensor('bed-pressure-element','P?',464,363,'vibro_fluidizer',anchor=[464,372],note='반송/배기 분기선상의 원형 계장. 문자는 원문 소형 이미지 판독한계')
edge('chamber-to-exhaust-control','chamber-pressure-control','c102-damper','instrument',[[435,247],[435,221],[585,221],[585,100],[795,100],[795,161]],confidence='visual-trace',color='yellow-green',note='원문 황록색 선을 연속 추적. 제어기 번호·정확한 논리는 미확정')
edge('bed-to-hp-drive-control','bed-pressure-control','drive-hp','instrument',[[464,345],[464,310],[544,310],[544,446],[676,446],[676,552]],confidence='visual-trace',color='yellow-green',note='원문 황록색 선을 연속 추적. 제어기능/인터록 로직은 추정하지 않음')

EQUIPMENT_TABLE=[
 {'sourceSection':'팬 기기표','componentId':c['id'],'tag':c['tag'],'rawTag':c.get('rawTag') or c.get('rawLabel'),'name':c['name'],'rawSpecs':c['rawSpecs']} for c in C if c['id'] in ['c100','c101','c102','c103','c104','c106']
]+[
 {'sourceSection':'펌프·블로어 기기표','componentId':c['id'],'tag':c['tag'],'rawTag':c.get('rawLabel'),'name':c['name'],'rawSpecs':c['rawSpecs']} for c in C if c['id'] in ['l100','p100','p101','oil_pump']
]+[
 {'sourceSection':'기타 기기표','componentId':'c300','tag':None,'rawTag':'C?00','name':'BLOWOUT FAN','rawSpecs':{'power':'5.5 kW'}},
 {'sourceSection':'기타 기기표','componentId':'vibro_fluidizer','tag':'M100','name':'VF','rawSpecs':{'power':'2.2 kW'}},
 {'sourceSection':'기타 기기표','componentId':'sieve1','tag':'M101 A/B','name':'SIEVE','rawSpecs':{'power':'0.6 kW','quantity':'2 EA'}},
 {'sourceSection':'기타 기기표','componentId':'sieve2','tag':'M102 A/B','name':'VIBRO SUITE','rawSpecs':{'power':'0.6 kW','quantity':'2 EA'}},
 {'sourceSection':'기타 기기표','componentId':'v100','tag':'V100','name':'BLOW-THROUGH VALVE','rawSpecs':{'power':'0.75 kW'}}
]

def write():
    assert len({x['id'] for x in C})==len(C)
    ids={x['id'] for x in C}
    assert all(e['from'] in ids and e['to'] in ids for e in E)
    for e in E:
        e.pop('inlineComponents',None)
        inline=[c['id'] for c in C if c.get('inlineOnConnection')==e['id']]
        if inline:e['inlineComponents']=inline
    d={'source':{'file':'열교환기 설치도.pptx','slide':2,'image':'ppt/media/image3.png','width':W,'height':H,
        'coordinateSystem':'sourcePosition x/y and routePoints are normalized to the unmodified 1160×786 source image; sourcePixel/routePixels are source-image pixels',
        'resolutionLimit':'PPT에 삽입된 래스터 이미지가 확보한 P&ID 원본입니다. EMF image5는 공사범위 표이며 벡터 P&ID가 아닙니다. 작은 압력 숫자와 계장번호는 모두 복원할 수 없습니다.',
        'idBoundary':'component id는 연결을 위한 식별자이며 숫자 태그가 판독 확정되었다는 뜻이 아닙니다. 공식 tag가 null인 경우 rawTag/rawLabel의 미판독 표기를 보존합니다.',
        'confidenceMeaning':'confirmed는 그림 속 기호·연결·명칭 존재 확인을 뜻합니다. 준공 또는 실측 검증 상태가 아니며 수치 항목의 미판독은 rawSpecs의 null 및 unreadable 필드로 구분합니다.'},
       'components':C,'connections':E,'groups':GROUPS,'equipmentTable':EQUIPMENT_TABLE,
       'equipmentTableCoverage':{'fanRows':6,'pumpAndBlowerRows':4,'otherOccupiedRows':5,'totalOccupiedRows':15,
        'note':'기타 기기표는 C?00/M100/M101 A,B/M102 A,B/V100의 5개 점유행입니다. M101과 M102는 각2 EA를 한 행에 표기합니다. 빈 행을 장치로 세지 않았습니다. 도면에만 있는 추가 팬·호이스트·펌프는 별도 노드로 보존했습니다.'},
       'labelsUnknown':[{'componentId':c['id'],'rawLabel':c.get('rawLabel'),'fields':[k for k,v in c['rawSpecs'].items() if v is None] if c['rawSpecs'] else [],'reason':c['confidenceNote']} for c in C if c['confidence']=='uncertain' or c.get('rawLabel') and ('미판독' in c['rawLabel'] or '?' in c['rawLabel'])],
       'coverage':{'components':len(C),'connections':len(E),'byType':dict(Counter(x['type'] for x in C)),'bySystem':dict(Counter(x['system'] for x in C)),
        'confidence':dict(Counter(x['confidence'] for x in C)),'status':'all major equipment groups plus visible CIP branches, valves, instruments and drive symbols transcribed; unreadable labels retained explicitly',
        'untracedOrUnresolved':[
          '도면 작은 계장번호·밸브번호·일부 압력 숫자는 판독되지 않음',
          '챔버 오른쪽 대구경 외곽곡선/분말 반송선/배기 취출점이 겹치는 구간은 uncertain edge로 분리',
          '범례가 없는 옅은 색 선은 시각적으로 추적하되 매체·제어기능을 확정하지 않음',
          'M 표기의 모터 기호는 관련 팬·펌프·장치에 통합. 개별 모터 사양과 설치좌표를 새로 만들지 않음',
          '3D 공간 위치는 이 P&ID의 평면좌표만으로 확정할 수 없음; 정면·평면 배치도와 교차검증 필요'],
        'completeClaim':False,'boundary':'보이는 도면 내용을 디지털로 재현한 자료이며 준공 P&ID나 검증된 설계 사양을 대신하지 않습니다.'}}
    (OUT/'pid_catalog.json').write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(d['coverage'],ensure_ascii=False))
    return d

if __name__=='__main__':write()
