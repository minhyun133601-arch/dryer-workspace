from pathlib import Path
from evidence_paths import EVIDENCE_ROOT
import json,hashlib,math,re
from playwright.sync_api import sync_playwright

ROOT=EVIDENCE_ROOT
WORK=Path(__file__).resolve().parent
OUT=ROOT/'최종자료'/'건조기 열교환기 시뮬레이터.html'
checks=[]
def check(name,ok,detail=None):
    assert ok,(name,detail)
    checks.append({'name':name,'passed':True,'detail':detail})
model=json.loads((WORK/'simulator_model.json').read_text('utf8'))
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    c=b.new_context(accept_downloads=True,viewport={'width':1440,'height':900})
    p=c.new_page();errors=[];requests=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http://','https://')) else None)
    p.goto(OUT.as_uri(),wait_until='load');p.wait_for_timeout(160)
    check('WebGL rendered',p.evaluate('window.heat3DReady===true'))
    check('model has canvas',p.locator('#model-canvas').evaluate('(e)=>e.width>100&&e.height>100'))
    check('no duplicate IDs',p.locator('[id]').evaluate_all('(es)=>new Set(es.map(e=>e.id)).size===es.length'))
    for case in model['cases']:
        inp=case['inputs'];ex=case['expected']
        p.locator('#reset').click();p.locator('#advanced-open').click()
        for key,id in [('coldMassKgH','cold-flow'),('hotMassKgH','hot-flow'),('gasPriceKRWm3','gas-price'),('hoursPerDay','hours'),('daysPerYear','days')]:p.locator('#'+id).fill(str(inp[key]))
        p.locator('#capex').fill(str(inp['investmentKRW']/10000));p.keyboard.press('Escape')
        for key,id,factor in [('coldInC','tin-number',1),('hotInC','hot-number',1),('effectiveness','epsilon-number',100)]:p.locator('#'+id).fill(str(inp[key]*factor))
        actual=p.evaluate('window.heatSimulatorState')
        for k,e in [('Q','heatKW'),('coldOut','coldOutC'),('hotOut','hotOutC'),('gas','gasSavingM3h'),('annual','annualGrossGasSavingKRW'),('payback','grossSimplePaybackYears')]:
            expected=ex[e]
            check(case['name']+'.'+k,actual[k] is None if expected is None else math.isclose(actual[k],expected,rel_tol=1e-10,abs_tol=1e-7),{'actual':actual[k],'expected':expected})
    p.locator('#reset').click()
    check('baseline financial visible',p.locator('#annual-exact').inner_text().startswith('277,992,000'))
    check('baseline payback visible',p.locator('#payback-output').inner_text()=='2.60')
    p.locator('#tin-number').fill('')
    check('blank rejected',not p.locator('#input-error').is_hidden())
    p.locator('#reset').click();p.locator('#epsilon-number').fill('101')
    check('effectiveness out of range rejected',not p.locator('#input-error').is_hidden())
    p.locator('#reset').click();p.locator('#advanced-open').click();p.locator('#cold-flow').fill('0')
    check('zero mass rejected',not p.locator('#input-error').is_hidden())
    p.locator('#cold-flow').fill('55000');p.locator('#delta-kw').fill('50');p.locator('#electricity-price').fill('150');p.locator('#maintenance').fill('500')
    check('net scenario',p.locator('#net-output').inner_text()=='21,899.2만원/년')
    check('net payback',p.locator('#net-payback').inner_text()=='3.31년')
    p.locator('#delta-kw').fill('');check('unknown power stays unknown',p.locator('#net-output').inner_text()=='미산정')
    p.keyboard.press('Escape');p.locator('#reset').click()
    label=p.locator('.heat-label');before=label.bounding_box()['x'];box=p.locator('#model-canvas').bounding_box()
    p.mouse.move(box['x']+box['width']*.22,box['y']+box['height']*.75);p.mouse.down();p.mouse.move(box['x']+box['width']*.22+120,box['y']+box['height']*.75-35,steps=8);p.mouse.up();p.wait_for_timeout(90)
    check('camera rotates with drag',abs(label.bounding_box()['x']-before)>2)
    p.locator('#view-iso').click();p.wait_for_timeout(950);check('camera reset',abs(label.bounding_box()['x']-before)<2)
    p.locator('[data-focus="supply"]').click();p.wait_for_timeout(950);check('component picking',p.locator('#component-name').inner_text()=='4층 급기 송풍기')
    check('source locator shown','C103' in p.locator('#component-source').inner_text())
    for id in ['heat','exhaust','supply']:
        p.locator('[data-focus="'+id+'"]').click();p.wait_for_timeout(950)
        check('smooth focus '+id,p.locator('[data-focus="'+id+'"]').evaluate('(e)=>e.classList.contains("active")'))
    p.locator('#view-iso').click();p.wait_for_timeout(950)
    state_before=p.evaluate('window.heatSimulatorState')
    p.locator('#report-toggle').click();p.wait_for_timeout(100)
    check('report mode opens',p.locator('body').evaluate('(e)=>e.classList.contains("presentation")'))
    check('report hides controls',p.locator('.controls').is_hidden())
    check('report retains financial inputs',p.evaluate('window.heatSimulatorState')==state_before)
    check('investment in first card',p.locator('#investment-output').inner_text()=='7.24')
    p.screenshot(path=str(WORK/'executive-report.png'),full_page=True)
    p.locator('#report-toggle').click();p.wait_for_timeout(100)
    p.locator('#tin-number').fill('25');p.locator('#hot-number').fill('90');p.locator('#epsilon-number').fill('65')
    custom=p.evaluate('window.heatSimulatorState');p.locator('#tour-start').click();p.wait_for_timeout(100)
    check('tour starts',p.evaluate('window.heatPresentationState.active'))
    check('tour enters report mode',p.locator('body').evaluate('(e)=>e.classList.contains("presentation")'))
    p.locator('#tour-pause').click();check('tour pauses',not p.evaluate('window.heatPresentationState.playing'))
    for i in range(1,5):
        p.locator('#tour-next').click();p.wait_for_timeout(70)
        check('tour step '+str(i),p.evaluate('window.heatPresentationState.index')==i)
        check('tour keeps inputs '+str(i),p.evaluate('window.heatSimulatorState')==custom)
    p.locator('#tour-prev').click();check('tour previous',p.evaluate('window.heatPresentationState.index')==3)
    p.locator('#tour-pause').click();check('tour resumes',p.evaluate('window.heatPresentationState.playing'))
    p.keyboard.press('Escape');check('tour escape',not p.evaluate('window.heatPresentationState.active'))
    check('tour retains all custom values',p.evaluate('window.heatSimulatorState')==custom)
    p.locator('#reset').click();p.locator('#view-iso').click();p.wait_for_timeout(950)
    for id in ['install','front','plan','pid']:
        p.locator('[data-drawing="'+id+'"]').click();check('source tab '+id,p.locator('#model-stage').is_hidden() and p.locator('#drawing-image').is_visible())
    p.locator('#expand').click();check('source image expands',p.locator('#image-dialog').evaluate('(e)=>e.open'));p.keyboard.press('Escape')
    p.locator('[data-drawing="model"]').click();p.wait_for_timeout(120)
    p.screenshot(path=str(WORK/'executive-desktop.png'),full_page=True)
    check('desktop first-screen results',p.locator('.results').bounding_box()['y']+p.locator('.results').bounding_box()['height']<=900)
    p.set_viewport_size({'width':1366,'height':768});p.wait_for_timeout(100);p.screenshot(path=str(WORK/'executive-compact.png'),full_page=True)
    check('compact first-screen results',p.locator('.results').bounding_box()['y']+p.locator('.results').bounding_box()['height']<=768,str(p.locator('.results').bounding_box()))
    p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(90);p.screenshot(path=str(WORK/'executive-mobile.png'),full_page=True)
    check('mobile no global overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    p.locator('#evidence-open').click()
    original=json.loads((WORK/'oneglance_receipt.json').read_text('utf8'))
    for f in original['files']:
        with p.expect_download() as dl:p.locator('[data-file="'+f['id']+'"]').click()
        check('original '+f['name'],hashlib.sha256(Path(dl.value.path()).read_bytes()).hexdigest()==f['sha256'])
    check('JavaScript errors',not errors,str(errors));check('no outside requests',not requests,str(requests))
    b.close()
(WORK/'executive_qa.json').write_text(json.dumps({'output':str(OUT),'checks':checks,'errors':errors,'outsideRequests':requests},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(checks),'output':str(OUT)},ensure_ascii=False))
