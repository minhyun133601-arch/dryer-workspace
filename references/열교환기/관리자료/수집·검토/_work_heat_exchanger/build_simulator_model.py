"""Independent Decimal controls for the epsilon sensible-heat simulator."""
import json
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 40
D = lambda value: Decimal(str(value))
WORK = Path(__file__).resolve().parent
BASE = {
    'coldInC': 20,
    'hotInC': 85,
    'coldMassKgH': 55000,
    'hotMassKgH': 93000,
    'effectiveness': 0.6,
    'cpKJkgK': 1.005,
    'gasPriceKRWm3': 1800,
    'hoursPerDay': 24,
    'daysPerYear': 300,
    'investmentKRW': 724000000,
}
BASE_Q_KW = D(55000) * D('1.005') / D(3600) * D(39)

def simulate(overrides):
    p = BASE | overrides
    v = {k: D(x) for k, x in p.items()}
    cc = v['coldMassKgH'] * v['cpKJkgK'] / D(3600)
    ch = v['hotMassKgH'] * v['cpKJkgK'] / D(3600)
    if cc <= 0 or ch <= 0:
        raise ValueError('Air mass flow and cp must be positive')
    if not D(0) <= v['effectiveness'] <= D(1):
        raise ValueError('Effectiveness must be between zero and one')
    if not D(0) <= v['hoursPerDay'] <= D(24):
        raise ValueError('Daily hours must be between zero and 24')
    if not D(0) <= v['daysPerYear'] <= D(365):
        raise ValueError('Annual days must be between zero and 365')
    if v['gasPriceKRWm3'] < 0 or v['investmentKRW'] <= 0:
        raise ValueError('Gas price must be nonnegative and investment positive')
    dt = max(v['hotInC'] - v['coldInC'], D(0))
    qmax = min(cc, ch) * dt
    q = v['effectiveness'] * qmax
    tco = v['coldInC'] + q / cc
    tho = v['hotInC'] - q / ch
    hours = v['hoursPerDay'] * v['daysPerYear']
    gas = D('21.45') * q / BASE_Q_KW
    annual_gas = gas * hours
    annual_money = annual_gas * v['gasPriceKRWm3']
    cold_heat = cc * (tco - v['coldInC'])
    hot_heat = ch * (v['hotInC'] - tho)
    assert abs(cold_heat - hot_heat) < D('1e-30')
    assert q <= qmax
    if dt > 0:
        assert v['coldInC'] <= tco <= v['hotInC']
        assert v['coldInC'] <= tho <= v['hotInC']
    out = {
        'coldCapacityKWperK': cc,
        'hotCapacityKWperK': ch,
        'minimumCapacityKWperK': min(cc, ch),
        'capacityRatio': min(cc, ch)/max(cc, ch),
        'maximumHeatKW': qmax,
        'heatKW': q,
        'coldOutC': tco,
        'hotOutC': tho,
        'coldTemperatureEfficiency': (tco-v['coldInC'])/dt if dt > 0 else D(0),
        'hotTemperatureEfficiency': (v['hotInC']-tho)/dt if dt > 0 else D(0),
        'coldSideHeatKW': cold_heat,
        'hotSideHeatKW': hot_heat,
        'annualHours': hours,
        'annualRecoveredHeatKWh': q*hours,
        'gasSavingM3h': gas,
        'annualGasSavingM3': annual_gas,
        'annualGrossGasSavingKRW': annual_money,
        'grossSimplePaybackYears': v['investmentKRW']/annual_money if annual_money > 0 else None,
    }
    return {'inputs':p, 'expected':{k:float(x) if x is not None else None for k,x in out.items()}}

cases = [
    ('baseline',{},'기안 급기59℃와 가스21.45m³/h를 맞춘 보정 기준'),
    ('hot90',{'hotInC':90},'견적의 배기90℃를 모델에 적용; 견적 배기출구64℃를 강제로 맞추지 않음'),
    ('cold35',{'coldInC':35},'급기출구는65℃로 계산됨; 이전 고정출구59℃ 모델과 다름'),
    ('cold0',{'coldInC':0},'찬 외기의 비교조건'),
    ('effectiveness0',{'effectiveness':0},'회수열0, 두 흐름 출구는 각 입구와 같음'),
    ('effectiveness1',{'effectiveness':1},'최대가능회수열의 이론상 상한; 실장치 보장조건 아님'),
    ('coldMassDouble',{'coldMassKgH':110000},'Cmin이배기측으로바뀌며급기온도효율은epsilon과달라짐'),
    ('coldMassHalf',{'coldMassKgH':27500},'출구온도는59℃를유지하나회수열은절반인시나리오'),
    ('hotMassHalf',{'hotMassKgH':46500},'열용량작은측이배기로바뀜'),
    ('bothMassHalf',{'coldMassKgH':27500,'hotMassKgH':46500},'두출구온도는기준과같아도회수열/가스비는절반'),
    ('equalMass',{'hotMassKgH':55000},'동일열용량에서배기출구46℃'),
    ('sameInletTemperature',{'hotInC':20},'열구동온도차0'),
    ('reverseTemperature',{'coldInC':40,'hotInC':20},'급기예열전용모드로회수열0;냉각모드미포함'),
    ('zeroOperatingDays',{'daysPerYear':0},'순간열수지는계산,연효과0/회수미산정'),
    ('zeroGasPrice',{'gasPriceKRWm3':0},'열·체적회수는있어도가스비절감0/회수미산정'),
]
test_cases = []
for name, overrides, note in cases:
    test_cases.append({'name':name,'note':note,**simulate(overrides)})

spec = {
    'modelId':'epsilon-sensible-heat-balance-calibrated-to-proposal',
    'asOf':'2026-11-03',
    'sourceDocId':'334757',
    'title':'정상상태 현열 회수 열수지 + 기안 가스절감량 비례 보정',
    'baselineInputs':BASE,
    'baselineHeatKW':float(BASE_Q_KW),
    'baselineGasSavingM3h':21.45,
    'modelParametersAndProvenance':[
        {'parameter':'coldInC','value':20,'source':'기안/견적/HTRI 급기 입구','status':'원문기재'},
        {'parameter':'hotInC','value':85,'source':'설치도PPT 배풍온도','status':'원문기재; 견적·HTRI90℃와구분'},
        {'parameter':'coldMassKgH','value':55000,'source':'견적2쪽 Supply air','status':'원문설계값;실측아님'},
        {'parameter':'hotMassKgH','value':93000,'source':'견적2쪽 Exhaust air','status':'원문설계값;실측아님'},
        {'parameter':'cpKJkgK','value':1.005,'source':'건공기 상수비열 근사 사용자 가정','status':'문서기재값아님;습도·잠열·온도변화미포함'},
        {'parameter':'effectiveness','value':0.6,'source':'기안의 급기20→59℃를 배기85℃·Cmin=급기 조건에 맞춤','status':'모델보정가정;업체보장유효도아님'},
        {'parameter':'gasCalibration','value':'gasSavingM3h=21.45*Q/Qbase','source':'기안가스절감21.45m³/h에기준열량을맞춘비례관계','status':'연료발열량·버너효율검증환산아님'},
    ],
    'equations':{
        'coldCapacityKWperK':'coldMassKgH * cpKJkgK / 3600',
        'hotCapacityKWperK':'hotMassKgH * cpKJkgK / 3600',
        'minimumCapacityKWperK':'min(coldCapacityKWperK,hotCapacityKWperK)',
        'maximumHeatKW':'minimumCapacityKWperK * max(hotInC-coldInC,0)',
        'heatKW':'effectiveness * maximumHeatKW',
        'coldOutC':'coldInC + heatKW/coldCapacityKWperK',
        'hotOutC':'hotInC - heatKW/hotCapacityKWperK',
        'gasSavingM3h':'21.45 * heatKW/598.8125',
        'annualGrossGasSavingKRW':'gasSavingM3h * gasPriceKRWm3 * hoursPerDay * daysPerYear',
        'grossSimplePaybackYears':'investmentKRW/annualGrossGasSavingKRW if annualGrossGasSavingKRW>0 else null',
        'annualRecoveredHeatKWh':'heatKW * hoursPerDay * daysPerYear',
        'coldTemperatureEfficiency':'effectiveness*minimumCapacityKWperK/coldCapacityKWperK when hotInC>coldInC',
    },
    'units':{
        'massFlow':'kg/h; kg/s로바꾸려면3600으로나눔',
        'specificHeat':'kJ/(kg·K)',
        'capacityRate':'(kg/s)*(kJ/kg/K)=kJ/s/K=kW/K',
        'heatTransferRate':'kW; 순간열전달률이며kWh가아님',
        'annualRecoveredHeat':'kW*h=kWh; 가스발열량의실측환산이아님',
        'temperatureDifference':'℃의차이는K의차이와동일',
        'money':'KRW원;표시만원은10000으로나눔',
        'kcalWarning':'원문kcal의정의(IT/thermochemical)미확인. 메인표시는kW권장; kcal변환을넣으면상수와근사임을명시.'
    },
    'recommendedLabels':{
        'mainModel':'정상상태 간이 열수지 · 문서 기준 보정 시나리오',
        'epsilon':'열회수 유효도 ε · 최대가능회수열 대비 비율',
        'baseline':'기안 급기59℃·가스21.45m³/h에 맞춘 기준',
        'economics':'가스비 기준 예상효과 · 전력·정비비 차감 전',
        'constantEffectiveness':'풍량을 바꿔도 입력한 ε를 유지하는 비교 가정',
        'negativeDrivingTemperature':'급기 예열 조건이 아니므로 회수열0으로 계산',
        'missingPayback':'이 조건에서는 회수 미산정',
    },
    'limitations':[
        '여러원문의입력값을조합하고급기59℃에epsilon을보정한예시로,하나의업체보증성능조건을재현한것이아니다.',
        '기안가스절감량21.45m³/h와열량사이의환산근거는확인되지않았다. 열량비례가스환산은독립적인연료발열량/효율검증이아니다.',
        '고정epsilon을선택한정상상태현열모델이다. 실장비의유량별UA/NTU/오염/압력손실/팬전력/성능곡선은계산하지않는다.',
        '공기두흐름의cp를같은건공기상수로가정한다. 실제건조배기의습도,응축·증발잠열,온도별cp변화는미포함이다.',
        '내부유로가대향류/교차류/병류중어떤배열인지는확인되지않았다. epsilon은입력가정이며특정배열에서그값이실제로달성가능함을보장하지않는다.',
        'epsilon1은이론적상한이다. 출구온도가서로교차할수있지만각출구가상대입구온도를넘지않는열수지상한을지킨다. 출구교차를강제로같게만들지않는다.',
        '입구고온측이저온측보다차갑다면회수열0인급기예열전용모드로처리한다. 역방향냉각성능은이모델의범위가아니다.',
        '연300일은설치후정상가동환산이며2026년실제절감액이아니다. 승인/설치/검수/지급은구분한다.',
        '724000000원은원문예상투자비이며부대비VAT와실제구조보강·천공등추가비는미확정이다.',
    ],
    'validation':{
        'mustBeFinite':['coldInC','hotInC','coldMassKgH','hotMassKgH','effectiveness','cpKJkgK','gasPriceKRWm3','hoursPerDay','daysPerYear','investmentKRW'],
        'strictlyPositive':['coldMassKgH','hotMassKgH','cpKJkgK','investmentKRW'],
        'range':{'effectiveness':[0,1],'hoursPerDay':[0,24],'daysPerYear':[0,365],'gasPriceKRWm3':[0,None]},
        'emptyInput':'未입력을0으로바꾸지않고입력확인으로표시',
        'zeroAnnualBenefit':'paybacknull;Infinity/NaN/0년표시금지',
        'zeroAirflow':'나누기0방지를위해입력확인. 흐름없는출구온도를0℃로만들지않음',
        'temperatureBounds':'hotIn>coldIn이면coldIn<=coldOut<=hotIn및coldIn<=hotOut<=hotIn',
        'heatBalance':'coldCapacity*(coldOut-coldIn)=hotCapacity*(hotIn-hotOut)=heatKW',
    },
    'primaryReferences':[
        {'title':'EnergyPlus Engineering Reference v24.2 — Heat Exchangers','url':'https://energyplus.net/assets/nrel_custom/pdfs/pdfs_v24.2.0/EngineeringReference.pdf','locator':'16.824–16.826; heat transfer rate and two outlet temperatures','supports':'epsilon*Cmin*입구온도차 및 Q/C 출구온도'},
        {'title':'ASHRAE Handbook Fundamentals — Chapter 4 Heat Transfer','url':'https://handbook.ashrae.org/Handbooks/F17/SI/f17_ch04/f17_ch04_si.aspx','locator':'NTU-Effectiveness Analysis, equations45–50','supports':'epsilon의정의와Cmin열용량율;실제배열/NTU에따라epsilon관계가달라짐'},
        {'title':'Official EnergyPlus source — Psychrometrics.hh','url':'https://github.com/NatLabRockies/EnergyPlus/blob/develop/src/EnergyPlus/Psychrometrics.hh','locator':'PsyCpAirFnW/PsyCpAirFnW_fast functions','supports':'공기비열은건공기항1.00484kJ/kgK와습도항을사용.1.005는근사사용자가정으로명시'},
    ],
    'cases':test_cases,
    'verification':{'arithmetic':'Decimal precision40 independent calculation','cases':len(test_cases),'heatBalanceAllCases':'passed','temperatureBoundsAllHeatingCases':'passed','originalSourcesOrHTMLModified':False},
}
output = WORK / 'simulator_model.json'
output.write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'output':str(output),'cases':len(test_cases),'baselineQkW':float(BASE_Q_KW),'baselineHotOutC':test_cases[0]['expected']['hotOutC']},ensure_ascii=False))
