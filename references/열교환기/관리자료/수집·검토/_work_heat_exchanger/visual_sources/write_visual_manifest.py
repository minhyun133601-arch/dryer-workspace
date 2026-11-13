import json, hashlib
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from evidence_paths import EVIDENCE_ROOT, load_source_json

ROOT=EVIDENCE_ROOT
WORK=Path(__file__).resolve().parents[1]
OUT=WORK/'visual_sources'
scope=load_source_json(WORK/'scope_audit.json')
ppt=scope['processFacts'][0]['sourceFile']
mapping=load_source_json(WORK/'render_mapping.json')
elevation=mapping[0]['source']
plan=mapping[-1]['source']

def asset(name, role, source, locator, dimensions, note=''):
    p=OUT/name
    return {'id':p.stem,'imagePath':p.as_posix(),'role':role,'sourceFile':source,
            'sourceLocator':locator,'width':dimensions[0],'height':dimensions[1],
            'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'note':note}

manifest={
 'purpose':'설치도·정면·평면·P&ID 원문을 한 화면 시각자료에 사용하기 위한 원본 재료와 오버레이 위치',
 'defaultRecommendation':'installation-route.png를 기본 도면으로 사용하면 원문에 있던 5층 열교환기, 4층 송풍기, 연결 설명선이 한 화면에 보입니다. 배치도 탭에서는 정면도와 평면도 전체를 확대해서 확인합니다.',
 'assets':[
   asset('installation-route.png','기본 공정·층간 연결 그림',ppt,'슬라이드 2 도면 영역', [2090,713],
         '원문 PPT 렌더를 픽셀 박스(208,598,2298,1311)로 자른 도면입니다. 원문 그림의 빨간 원·화살표·사진을 그대로 포함합니다. 새 장치나 동선을 그려 넣지 않았습니다.'),
   asset('install-slide-2.png','설치 개요 원문 전체',ppt,'슬라이드 2 전체',[2560,1440],
         '5층 열교환기에서 회수열을 4층 송풍기로 투입하는 계획을 글과 그림으로 직접 설명합니다. PowerPoint ReadOnly/WithWindowFalse로 열고 PNG Export한 뒤 이 문서만 닫았습니다. 기존 앱은 종료하지 않았습니다.'),
   asset('install-slide-3.png','업체·자사 공사범위 원문',ppt,'슬라이드 3 전체',[2560,1440]),
   asset('elevation-full.png','설치 정면 배치도',elevation,'1쪽',[2621,1853],
         '기계·덕트·층별 배치를 확인하는 도면입니다. 도면상의 위치만으로 세부 유동방향 또는 부품 명칭을 새로 확정하지 않습니다.'),
   asset('plan-full.png','설치 평면 배치도',plan,'1쪽',[2621,1853],
         '부품 외곽과 덕트 연결 및 치수를 보존했습니다. 사용자 확인용 확대 그림에 적합합니다.'),
   asset('pid-original.png','P&ID 원 삽입이미지',ppt,'슬라이드 2 삽입 P&ID',[1160,786],
         '슬라이드에 삽입된 원본 image3.png를 복사했습니다. 새 열회수 관련 표시는 녹색이고, 기존 배기팬 C102 및 급기팬 C103 계통은 별도로 식별해야 합니다.'),
   asset('pid-recovery-detail.png','P&ID 열회수 구역 확대',ppt,'슬라이드 2 P&ID 중 오른쪽 상부',[960,870],
         '원본 P&ID의 픽셀박스(750,70,1070,360)를 자르고 3배 확대한 보기입니다. 원문 해상도 이상으로 정보를 복원한 것은 아닙니다.'),
   asset('supply-fan-photo.jpeg','4층 송풍기 현장 사진',ppt,'슬라이드 2 사진',[424,196],
         '슬라이드에 있던 image4.jpeg를 바이트 그대로 복사했습니다.')
 ],
 'callouts':{
  'installation-route.png':[
   {'id':'heat-exchanger-floor5','x':0.7962,'y':0.2553,'label':'5층 열교환기','basis':'슬라이드 원문 빨간 원 내부 및 5층 열교환기 라벨','use':'예열 후 급기 온도값을 연결해 표시할 수 있는 원문 설명 위치. 실제 센서 장착점으로 주장하지 않음'},
   {'id':'supply-fan-floor4','x':0.1756,'y':0.3815,'label':'4층 송풍기','basis':'슬라이드 원문 왼쪽 빨간 원과 4층 송풍기 라벨','use':'예열공기 투입방향 목적지. 신규 Exhaust fan 200kW 또는 C102 배기팬220kW 수치를 이곳에 붙이지 않음'},
   {'id':'site-photo','x':0.1885,'y':0.6578,'label':'4층 송풍기 사진','basis':'원문 사진이 이 위치에 배치되어 있음','use':'장소의 실제 모습을 보여주는 보조 자료'}
  ],
  'pid-original.png':[
   {'id':'exhaust-fan-c102','x':0.7060,'y':0.2130,'label':'C102 배기팬','basis':'P&ID 기호 아래 C102, 하단 기기표 C102 EXHAUST FAN 220kW','use':'기존 배기팬의 도면 표기. 실제 명판·소비전력 확인값으로 쓰지 않음'},
   {'id':'heat-recovery-zone','x':0.8060,'y':0.3070,'label':'원문 열교환기 표시 구역','basis':'녹색 열회수 계통 및 PPT 빨간 원이 겹치는 영역','use':'정확한 센서 위치·세부 유동 방향은 덧그리지 않음'}
  ]
 },
 'explanatoryArrow':{
   'asset':'installation-route.png',
   'polylineNormalized':[[0.798,0.407],[0.798,0.473],[0.202,0.444]],
   'direction':'5층 열교환기에서 4층 송풍기 쪽으로',
   'basis':'PPT 슬라이드2에 이미 그려진 빨간 연결 설명선',
   'boundary':'이 선은 원문이 설명하는 층간 예열공기 투입 방향입니다. 실제 덕트의 모든 경유점·길이·센서위치를 뜻하지 않습니다.'
 },
 'powerLabels':{
  'existingExhaustFan':{'tag':'C102','ratingKW':220,'source':'PPT2 P&ID 하단 기기표','status':'기존 도면 정격 표기'},
  'existingSupplyFan':{'tag':'C103','ratingKW':76,'source':'PPT2 P&ID 하단 기기표','status':'급기팬 별도 기기'},
  'newExhaustFan':{'ratingKW':200,'source':'제작설치 견적2쪽 항목07','status':'신규 견적 정격'},
  'warning':'4층 송풍기(급기쪽)와 200/220kW 비교대상인 배기팬을 합쳐 한 팬으로 그리지 않습니다. 정격차이20kW는 실제 절감전력이 아닙니다.'
 },
 'temperatureLabels':{
  'slide2ExhaustReferenceC':85,
  'bodySupplyInC':20,'bodySupplyOutC':59,
  'quoteSupplyInC':20,'quoteSupplyOutC':62,'quoteExhaustInC':90,'quoteExhaustOutC':64,
  'boundary':'PPT 배기85℃, 기안급기59℃, 견적배기90/64℃·급기62℃는 서로 다른 원문 조건입니다. 도면의 실제 측정점 값 또는 한 조건에서 동시에 보장된 실측으로 표시하지 않습니다.'
 },
 'sourceFilesUntouched':True,
 'sourceRenderingMethod':'PowerPoint COM read-only slide PNG export and PyMuPDF PDF render; literal crops/copies for display; no saved edits to source documents.'
}
(OUT/'visual_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(str(OUT/'visual_manifest.json'))
