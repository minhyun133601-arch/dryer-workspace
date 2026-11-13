import json
from pathlib import Path

W=Path(__file__).resolve().parent
PAGE=[1191.0,842.0]
FX0,FY0,FS=366.48,677.28,27000/(840.84-366.48)
PX0,PZ0,PS=355.68,218.52,27000/(964.44-355.68)

def survey(id,name,kind,front,plan,confidence='medium',notes=None,frontAnchor=None,planAnchor=None,links=None):
    fa=frontAnchor or ([(front[0]+front[2])/2,(front[1]+front[3])/2] if front else None)
    pa=planAnchor or ([(plan[0]+plan[2])/2,(plan[1]+plan[3])/2] if plan else None)
    # Correspondence is a visual survey, not a manufacturing dimensional claim.
    x=(pa[0]-PX0)*PS/1000 if pa else (fa[0]-FX0)*FS/1000 if fa else None
    y=(FY0-fa[1])*FS/1000 if fa else None
    z=(pa[1]-PZ0)*PS/1000 if pa else None
    return {'id':id,'name':name,'kind':kind,'confidence':confidence,'frontBoundsPt':front,'planBoundsPt':plan,
        'frontBoundsNormalized':[round(v/PAGE[i%2],6) for i,v in enumerate(front)] if front else None,
        'planBoundsNormalized':[round(v/PAGE[i%2],6) for i,v in enumerate(plan)] if plan else None,
        'frontAnchorPt':fa,'planAnchorPt':pa,
        'center':[round(v,4) if v is not None else None for v in [x,y,z]],
        'sizeFromProjectedBounds':[
            round((front[2]-front[0])*FS/1000,4) if front else None,
            round((front[3]-front[1])*FS/1000,4) if front else None,
            round((plan[3]-plan[1])*PS/1000,4) if plan else None],
        'coordinateStatus':'도면 투영의 시각 서베이 근사. 제작 치수·현장 측량값이 아님.',
        'notes':notes or [],'sourceLocators':links or ['정면도1쪽','평면도1쪽']}

items=[]
items.append(survey('E01','기존 건조 챔버','dryer',[396,224,553,499],[386,287,595,494],'high',
    ['정면 원통/원뿔 외곽, 평면 원형 외곽을 대응. 평면에는 상부 덕트·링도 중첩되어 있으므로 모든 외곽을 몸체 직경으로 사용하지 않음.',
     '직접 제조 직경은 확인하지 못함. 앞쪽원통 높이와하부원뿔 비례를 도면투영에 맞출 것.',
     '상부 급기부/분배부는 E02로 분리. 하부 배출은 E03으로 연결.'],frontAnchor=[471.96,355],planAnchor=[490.86,387.54]))
items.append(survey('E02','건조기 상부 급기·가열 연결부','dryer-top-air',[422,195,519,229],[441,219,579,385],'medium',
    ['정면은 상부곡관과사각전이,평면은환형/접선형외곽. 단순돔만올리지말고곡관+사각전이를조합.',
     '정확 버너/분배기 내부는 P&ID와 별도 대응.']))
items.append(survey('E03','기존 하부 유동층/수평 제품 회수 장치','fluidizer',[456,525,648,568],[489,362,646,413],'medium',
    ['P&ID VIBRO FLUIDIZER와 실루엣을 대응할 수 있음.',
     '긴 수평 직사각함체·지지다리·스프링 및복수유입관으로표현.',
     '평면 도면에는 상부·하부 투영이 중첩되어 정확 깊이 외곽은 미확정.']))
items.append(survey('E04','유동층 후단 경사 배출장치','inclined-discharge',[638,549,667,569],[645,379,677,399],'low',
    ['경사 스크린/배출기 같은 형상. 정확 명칭·태그는 미확정이므로 일반체로표현.',
     '생략하지 말되 제품공정 연결선으로만 기능을 표시.']))
for i,(x,px,bottom) in enumerate([(647.6,716.4,502),(698.1,781.2,489),(751.7,849.9,480)],1):
    items.append(survey(f'E1{i}',f'기존 사이클론 {i}','cyclone',[x-23,292,x+23,bottom],[px-29.3,303.4,px+29.3,361.8],'medium',
       ['3개 장치가 공통 배기 헤더에 분기하는 집진군. 하나씩 차례로 통과하는 직렬 장치로 표현하지 않음.',
        '원통·깊은 원뿔·하부 길게 내려오는 제품 회수관을 구분.',
        '정면 bounds는 상부 배기부에서 하부 배출관까지의 조립영역이므로 이를 단일 원뿔 높이로 사용하지 않음.'],
        frontAnchor=[x,375],planAnchor=[px,332.2],links=['기존 P&ID CYCLONE 3개','정면도 중앙 우측','평면도 우측 상부 3원형']))
items.append(survey('E14','사이클론 공통 상부 배기 헤더','exhaust-header',[620,289,774,311],[711,326,853,336],'high',
    ['집진군 각 상부에서 공통 배기팬 쪽으로 연결되는 헤더.', '이 헤더와 하부 제품회수라인 E15를 구분.']))
items.append(survey('E15','사이클론 하부 제품 회수·이송 연결','product-return',[642,464,785,505],[703,348,852,426],'medium',
    ['정면에서 비스듬한 수평회수관이 각 사이클론 하부와 연결.', '가스가 흐르는 폐열회수 덕트와 색·굵기·라벨을 달리함.']))
items.append(survey('N01','신규 열교환 코어 투영부','preheater-core',[655,233,700,286],[727,521,780,590],'high',
    ['빨간 반복선으로 나타난 열교환 코어 영역을 양도면에서 대응.',
     '평면약2.35m 폭×3.06m 깊이는 견적챔버 3000×2300과정합하나최종제작치수로단정하지않음.',
     '내부 판/핀 수량은 도면 반복선의 직접 기계부품 수가 아님.'],frontAnchor=[677.5,259.5],planAnchor=[753.5,555.5]))
items.append(survey('N02','신규 상부 챔버','preheater-upper',[658,206,699,233],[724,518,783,593],'medium',
    ['상부 사각챔버와원형점검/접속구. 견적ITEM02 Size3000×2300×1450L.',
     '상하챔버평면외곽은코어와겹침. 상부CIP노즐배관별도.'],frontAnchor=[677.5,219.5],planAnchor=[753.5,555.5]))
items.append(survey('N03','신규 하부 챔버·전이부','preheater-lower',[655,285,702,315],[724,518,783,593],'medium',
    ['견적ITEM03 Size3000×2300×1400L. 하부덕트/배기팬투영과겹치는영역이있음.',
     '하부코어/챔버와 팬을 동일 기기로 합치지 않음.'],frontAnchor=[677.5,300],planAnchor=[753.5,555.5]))
items.append(survey('N04','교체 배기팬·모터','exhaust-fan',[658,277,709,316],[737.76,453.0,785.0,501.0],'high',
    ['평면에서 회수코어보다북측(작은Z)에있어정면에서겹쳐보임.',
     '순수팬하우징곡면bbox는plan737.76,453.0..769.08,477.12,모터/받침까지포함영역은더큼.',
     '신규200kW정격,기존P&ID C102220kW;별도급기팬E20과혼동금지.'],
    frontAnchor=[690,292],planAnchor=[753.42,465.06],links=['견적ITEM07','제작스케줄 배기팬철거설치','정면/평면녹색팬조립체']))
items.append(survey('N05','열교환기 지지 프레임/접근 사다리','support-frame',[630,260,719,344],[684,433,790,513],'high',
    ['전면기둥/상부보/프레임외곽과왼쪽사다리.',
     '견적H-beam200×200,Channel150×75,Baseplate350×350×25t,Ladder와대응.',
     '시각범위의 프레임이고 정확 부재/접합구조는 미확정.']))
items.append(survey('N06','급기 필터/사각-원형 전이부','supply-filter',[618,235,655,258],[688,521,727,590],'medium',
    ['견적ITEM05급기필터 및ITEM04 Heatingairoutduct전이부가단순화가능.',
     '정확필터박스와사각전이부각각의정면투영역은제작도없어분리식별불확실. 원문P&ID입구필터기호로존재를확인.']))
items.append(survey('N07','CIP 헤더·세척 분기관','cip-header',[658,201,704,236],[724,516,787,594],'medium',
    ['원문P&ID에CIP SUPPLY,코어상부로내려오는다수분기표시.',
     '기구위치는개념배치;노즐수량·간격을확정치수로만들지않음.']))
items.append(survey('E20','4층 급기 송풍기·모터','supply-fan',[381,412,427,448],[375,493,438,557],'high',
    ['PPT사진과4층라벨에직접대응.',
     '신규C102배기팬과분리.기존C103급기팬계통.',
     '좌측 모터, 원형 흡입부가 보이는 원심팬 하우징, 기존수직급기덕트로연결.'],
    frontAnchor=[408.5,429],planAnchor=[408.5,520],links=['설치도PPT2 4층송풍기','기존P&ID C103','정면좌측낮은팬']))
items.append(survey('E21','습식집진기 본체','wet-scrubber',[767,306,822,429],[870,405,928,475],'high',
    ['우측원통+하부원뿔과상부긴배기스택E22. 기존P&ID WET SCRUBBER.',
     '정면두입출구덕트와신규회수기후단배기덕트가중첩.'],frontAnchor=[794.4,368],planAnchor=[906,440]))
items.append(survey('E22','습식집진기 배기 스택','stack',[776,113,811,307],[886,421,920,459],'medium',
    ['정면에서 지붕보다 위로 솟는 직선스택. 실제높이도면투영근사.',
     '원문평면에서는집진기중심또는접속원형으로겹쳐보임.']))
items.append(survey('E23','습식집진 하부 보조탱크/드레인','wet-tank',[800,521,843,569],[919,405,951,438],'medium',
    ['위 집진기와 아래 원형탱크 사이에가는배수/순환연결관.',
     '기존P&ID WET SCRUBBER TANK 후보지만기기제조태그확정X.'],frontAnchor=[820.5,546],planAnchor=[934.5,416.5]))
items.append(survey('U01','하부 교반 보조탱크','utility-agitated-tank',[372,615,418,677],[366,229,402,263],'medium',
    ['정면하부좌측:상부모터/뚜껑/원통/원뿔/다리·측면가는배관.',
     '평면상부좌측원형설비와위치대응추정. CIP/온수탱크실제기능은미확정.'],frontAnchor=[397,649],planAnchor=[385,245]))
items.append(survey('U02','하부 보조 캐비닛','utility-cabinet',[432,646,460,677],[440,229,480,257],'low',
    ['정면보조탱크옆사각장치와평면상부좌측사각영역의대응후보.',
     '열원/펌프/캐비닛명칭미확정. 일반상자형상+미확정라벨.']))
for i,x in enumerate([473,525,577,616],1):
    items.append(survey(f'U1{i}',f'기존 보조 송풍/가열 모듈 {i}','aux-module',[x-10,417,x+13,448],None,'low',
        ['정면유동층상부주변의4개작은기계실루엣중하나.',
         '각P&ID팬·히터섹션과개별태그매핑은미확정.',
         '도면보이는수량/외곽은재현하되새로운기능·사양을추정하지않음.']))
items.append(survey('P01','평면 우측 하부 X표 사각 영역','unidentified-plan-outline',None,[875,539,964,601],'low',
    ['상자모양처럼보이나개구부/샤프트/장비기호중정확해석미확정.',
     '3D솔리드장비로발명하지말고해당위치에얇은와이어/해칭표시로보존.']))
items.append(survey('P02','건조기 우측 대각 계단/접근 구조','access-stair',[459,211,613,344],[355,571,625,601],'medium',
    ['정면왼쪽상층에서우측중층으로내려가는대각선기존접근구조.',
     '평면남측긴구간의단차/사다리표현과연관후보;정확동일구조매핑은미확정.']))
for i,y in enumerate([425,475,525],1):
    items.append(survey(f'P1{i}',f'평면 건조기 좌측 원형 플랜지/장치 투영 {i}','unidentified-circular-projection',None,[374,y-23,420,y+23],'low',
        ['평면에3개원형외곽과복수접속/플랜지/점검부형상이보임.',
         '서로다른독립탱크인지다층관로투영인지미확정.확인없이원통탱크3개를솔리드로추가하지않음.',
         '하단투영은급기팬하우징/모터와중첩.2D와이어/가이드윤곽으로보존권장.']))
items.append(survey('P14','평면 상단 작은 사각 단면 기호','unidentified-plan-section',None,[475,215,515,225],'low',
    ['건물북측상단의X표사각단면기호.덕트단면/개구부후보이나확정못함.얇은와이어윤곽만권장.']))
items.append(survey('P15','평면 보조 직사각 받침/장치 쌍','unidentified-plan-pair',None,[366,272,401,294],'low',
    ['기존보조교반탱크아래두직사각장치투영.명칭·기능·높이확정못함.',
     '기존설비가려진부분을생략하지않기위한2D영역ID.']))

cross_checks=[]
for a in items:
    if not a['frontAnchorPt'] or not a['planAnchorPt']:continue
    xf=(a['frontAnchorPt'][0]-FX0)*FS/1000
    xp=(a['planAnchorPt'][0]-PX0)*PS/1000
    error=abs(xf-xp)
    a['frontPlanXCheck']={'frontXM':round(xf,4),'planXM':round(xp,4),'absDifferenceM':round(error,4),
        'interpretation':'투영중심근사매칭' if error<=0.5 else '부품중심/투영범위상이또는매칭후보.정확대응으로쓰지않음'}
    a['modelPlacementPriority']={'x':'평면anchor우선인현재center값.중심차경고가있는기기는확정공통실물좌표로사용하지않음.','y':'정면anchor높이우선','z':'평면anchor깊이우선',
       'projectionXSpanM':[round(min(xf,xp),4),round(max(xf,xp),4)],
       'spanMeaning':'두수작업anchor의X위치범위.실측오차막대/통계적신뢰구간아님.'}
    if error>0.5:
        a['correspondenceStatus']='동일기능/인접투영영역의대응후보.중심기준과투영범위상이.'
        a['solidPlacementStatus']='비축척설명용개략.두투영동시정합제작좌표아님.'
    else:
        a['correspondenceStatus']='주요장치의X투영근사정합.깊이·높이는각도면anchor에서취함.'
    if a['id'] in ['E04','P02']:
        a['correspondenceStatus']='동일실물대응미확정.정면영역과평면영역을분리보존.'
        a['solidPlacementStatus']='정확실물솔리드로병합금지.각도면별와이어/반투명영역으로보존권장.'
        a['recommendedRenderModes']=['front projected outline','plan projected outline']
    if error>0.5:cross_checks.append({'id':a['id'],'name':a['name'],**a['frontPlanXCheck']})

payload={
 'reviewedAsOf':'2026-11-03','documentId':'334757',
 'drawingNature':{'frontVectorPaths':22410,'planVectorPaths':13922,'rasterImages':0,'displayPagePt':PAGE,'nativeMediaBoxPt':[842,1191],'pageRotation':270,'pointNote':'아래좌표는270도회전반영후1191×842가로화면의PDF display좌표. get_drawings원시좌표에는page.rotation_matrix를먼저적용해야함.'},
 'coordinateSystem':{
  'units':'m, 도면치수에맞춘상대좌표;site survey값아님',
  'axes':{'x':'좌측공정기준선에서우측으로','y':'정면최하부기준선에서위로','z':'평면북측내부기준선에서남측으로'},
  'front':{'processXDatumPt':FX0,'baseYDatumPt':FY0,'mmPerPdfPoint':FS,'formulaX':'(frontX−366.48)×56.915mm','formulaY':'(677.28−frontY)×56.915mm'},
  'plan':{'processXDatumPt':PX0,'northInternalYDatumPt':PZ0,'mmPerPdfPoint':PS,'formulaX':'(planX−355.68)×44.354mm','formulaZ':'(planY−218.52)×44.354mm'},
  'registrationNote':'건조기중심front471.96/plan490.0의worldX가각약6m로정합.회수코어front677.5/plan753.5도약17.7m로정합. 깊이좌표는평면값을우선,높이는정면값을우선.'},
 'building':{
  'frontProcessBoundsPt':[366.48,132.6,840.84,677.28],
  'frontBuildingBoundsPt':[232.92,132.6,840.84,677.28],
  'planInternalBoundsPt':[184.32,218.52,964.44,601.8],
  'planOuterDepthBoundsPt':[179.88,213.96,968.88,606.24],
  'confirmedDimensionLabels':{'frontOverallWidth':34600,'frontProcessWidth':27000,'frontOverallHeight':31000,'planOverallWidth':34600,'planProcessWidth':27000,'planOuterDepth':17400,'planInnerDepth':17000},
  'dimensionUnitBoundary':'도면치수관례에따른mm상대변환.최종제작·시공단위는원문/계약확인. 박스기하정보와확정제작사양을구별.',
  'relativeLevels':[{'yPdf':677.28,'heightM':0},{'yPdf':571.8,'heightM':6},{'yPdf':448.92,'heightM':13},{'yPdf':343.44,'heightM':19},{'yPdf':229.2,'heightM':25.5},{'yPdf':132.6,'heightM':31}],
  'criticalPartialLevel':{'heightM':25.5,'sourceSpanXPt':[232.92,577.32],'note':'이높이수평마젠타구조선은건물왼쪽건조기구간에만있음.우측회수기구간까지전폭바닥을추가하면원문과달리장치와충돌.'},
  'floorNameMapping':{'status':'inferred','candidate':'상대13m구간급기팬을PPT4층,상대19m구간회수기설치기반을PPT5층으로읽을수있으나도면에층명직접라벨은없음.높이의상대치수와층명매핑을분리.'}},
 'cadDerivedProfiles':{
  'boundary':'다음은PDF벡터실루엣과도면영역치수로역산한기하근사이며직접기입된제작치수아님. PDF선두께/중첩/투영부재를고려해단순실루엣용으로사용.',
  'dryer':{
    'planOuterCirclePt':[393.84,290.52,587.88,484.56],
    'planSecondCirclePt':[396.12,292.8,585.6,482.28],
    'planCircleCentrePt':[490.86,387.54],
    'inferredOuterDiameterM':round(194.04*PS/1000,4),
    'inferredSecondDiameterM':round(189.48*PS/1000,4),
    'frontOuterCylinderPt':[396.6,228.24,547.2,343.44],
    'frontInnerCylinderPt':[398.16,232.8,545.76,337.08],
    'frontInnerConeEdgesPt':[[398.16,337.08,463.08,494.04],[545.76,337.08,480.72,494.04]],
    'inferredCylinderInnerDiameterM':round((545.76-398.16)*FS/1000,4),
    'inferredCylinderInnerHeightM':round((337.08-232.8)*FS/1000,4),
    'inferredConeInnerHeightM':round((494.04-337.08)*FS/1000,4),
    'inferredConeOutletDiameterM':round((480.72-463.08)*FS/1000,4),
    'interpretation':'평면외곽8.61m/둘째원8.40m,정면내경8.40m·출구약1.00m가서로정합.전형적인짧은콘보다긴원뿔형실루엣을원문에맞춰재현할근거.'}
 },
 'items':items,
 'ductSurvey':[
  {'id':'D01','name':'급기송풍기→기존가열/상부급기연결','source':'정면좌측수직원형덕트와상부90도엘보','frontCenterlinePt':[[408,429],[408,242],[418,220],[447,205],[494,205]],'confidence':'medium','circuit':'fresh/heated supply','note':'팬에서건조기상부쪽기존경로.온도21.45예상값의센서위치를이선에확정하지않음.'},
  {'id':'D02','name':'신규예열급기층간덕트','source':'견적ITEM10+정면녹색회수기왼쪽연결+PPT5층→4층','frontCenterlinePt':[[655,246],[629,246],[612,265],[612,394],[596,424],[414,424]],'confidence':'medium','circuit':'preheated fresh supply','rawDiameter':'Ø1100','note':'실제도면기하투영에맞춘개략선.곡관반경과평면각도는제작상세미확정.'},
  {'id':'D03','name':'기존건조기배출→집진군','source':'정면건조기하부측면에서사이클론구역상부/우측으로굽는굵은덕트','frontCenterlinePt':[[479,396],[570,388],[584,374],[584,349],[612,322],[647,315]],'confidence':'medium','circuit':'hot process exhaust','note':'원문P&ID와대조해집진군경로로읽을수있으나정면투영만으로각장치깊이는확정못함.'},
  {'id':'D04','name':'사이클론공통헤더→교체배기팬','source':'P&ID C102 및평면신규팬북측집진군후단연결','frontCenterlinePt':[[647,296],[748,296],[709,292]],'confidence':'low','circuit':'hot exhaust','note':'3사이클론공통헤더연결.중첩된정면상세단일꺾임길이를최종배관제작경로로사용하지않음.'},
  {'id':'D05','name':'배기팬→열교환기','source':'견적ITEM08','confidence':'high','circuit':'hot exhaust','rawDiameter':'Ø1200','note':'fan과회수코어가평면깊이방향약4m분리되어있음.원문앞뒤배치반영.'},
  {'id':'D06','name':'열교환기→습식집진기','source':'견적ITEM09+정면우측U자형덕트','frontCenterlinePt':[[699,243],[710,243],[710,280],[706,291],[737,291],[748,302],[748,364],[763,388],[794,392]],'confidence':'medium','circuit':'cooled exhaust','rawDiameter':'Ø1200','note':'회수기후단습식집진연결.정면U자실루엣을살리되급기덕트와회로분리.'},
  {'id':'D07','name':'CIP헤더/세척분기','source':'P&ID녹색CIP SUPPLY','confidence':'high_presence_low_geometry','circuit':'wash liquid','note':'얇은별도라인.노즐수량·3D장착점미확정.'}
 ],
 'sourceAssets':{'frontSvg':'source_assets/front.svg','planSvg':'source_assets/plan.svg','frontRaster6x':'source_assets/front-6x.png','planRaster6x':'source_assets/plan-6x.png','crops':['crops/dryer-zone.png','crops/recovery-zone.png','crops/lower-utilities.png','crops/dryer-plan.png','crops/recovery-plan.png']},
 'coverage':{'equipmentOrRegions':len(items),'unmatchedFrontIds':[x['id'] for x in items if x['frontBoundsPt'] and not x['planBoundsPt']],'unmatchedPlanIds':[x['id'] for x in items if x['planBoundsPt'] and not x['frontBoundsPt']],'frontPlanCorrespondenceWarnings':cross_checks,'note':'매칭이약한보조설비도누락하지않고low-confidenceID로보존.미확정기기는고유기능/태그를발명하지않음. E02/E03/E04/E15/N04/N05/P02는중심상이또는투영범위상이로주의.'},
 'doNotInfer':['두2D투영만으로모든덕트의깊이·엘보반경을완전확정','정면보조팬4개를확인없이특정P&ID태그로동일시','평면X표사각형을확인없이새장비솔리드로제작','3개사이클론의직렬연속배기가동','정격220−200kW실제절감','실제준공·성능검수상태']
}
(W/'front_plan_survey.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'items':len(items),'output':str(W/'front_plan_survey.json'),'unmatchedFront':payload['coverage']['unmatchedFrontIds'],'unmatchedPlan':payload['coverage']['unmatchedPlanIds']},ensure_ascii=False))
