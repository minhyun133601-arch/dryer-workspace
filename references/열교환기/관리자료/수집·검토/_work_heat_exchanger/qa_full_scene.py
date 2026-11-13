from pathlib import Path
from evidence_paths import EVIDENCE_ROOT
import json, math, hashlib, base64, re
from playwright.sync_api import sync_playwright

W=Path(__file__).resolve().parent
ROOT=EVIDENCE_ROOT
OUT=ROOT/'최종자료/건조기 열교환기 시뮬레이터.html'
checks=[]
def check(name,ok,detail=None):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: raise AssertionError((name,detail))
spec=json.loads((W/'simulator_model.json').read_text('utf8'))
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    try:
        p=b.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
        errors=[]; requests=[]
        p.on('pageerror',lambda e:errors.append(str(e)))
        p.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
        p.goto(OUT.as_uri(),wait_until='load');p.wait_for_timeout(250)
        check('WebGL ready',p.evaluate('window.heat3DReady'))
        check('No duplicate IDs',p.locator('[id]').evaluate_all('(es)=>es.length===new Set(es.map(e=>e.id)).size'))
        for case in spec['cases']:
            i=case['inputs']; values={'tin-number':i['coldInC'],'hot-number':i['hotInC'],'epsilon-number':i['effectiveness']*100,'cold-flow':i['coldMassKgH'],'hot-flow':i['hotMassKgH'],'gas-price':i['gasPriceKRWm3'],'hours':i['hoursPerDay'],'days':i['daysPerYear'],'capex':i['investmentKRW']/10000}
            a=p.evaluate('(v)=>{Object.entries(v).forEach(([k,n])=>document.getElementById(k).value=n);window.recalculateHeatSimulator();return window.heatSimulatorState}',values)
            for k,ek in [('Q','heatKW'),('coldOut','coldOutC'),('hotOut','hotOutC'),('gas','gasSavingM3h'),('annual','annualGrossGasSavingKRW'),('payback','grossSimplePaybackYears')]:
                e=case['expected'][ek];check(case['name']+'.'+k,a[k] is None if e is None else math.isclose(a[k],e,rel_tol=1e-10,abs_tol=1e-7))
        p.locator('#reset').click()
        state=p.evaluate('window.heatReconstruction.state()')
        check('Source survey 33 items',state['surveyItems']==33)
        check('P&ID 213 nodes /175 edges',(state['pidNodes'],state['pidEdges'])==(213,175))
        check('Survey all represented',p.evaluate('heatReconstruction.coverage.survey.every(i=>heatReconstructionScene.groups[i.id])'))
        check('Uncertain projections have no invented solid',p.evaluate("['E04','P02','U11','U12','U13','U14','P01','P11','P12','P13','P14','P15'].every(id=>heatReconstructionScene.groups[id].children.every(o=>!o.isMesh))"))
        p.screenshot(path=str(W/'full-final-overview.png'))
        p.locator('[data-focus="aux"]').click();p.wait_for_timeout(100)
        a=p.evaluate('heatReconstruction.state()');check('Auxiliary gallery active',a['scene']['layer']=='aux')
        check('Auxiliary warning visible',p.locator('#aux-caption').is_visible())
        check('Only concept equipment visible',p.evaluate('Object.entries(heatReconstructionScene.groups).every(([id,g])=>g.visible===heatReconstructionScene.auxIds.has(id))'))
        check('All conceptual equipment has source counterpart',p.evaluate("[...heatReconstructionScene.auxIds].every(id=>heatReconstruction.coverage.pid.some(n=>n.id===id.slice(4)&&n.status==='concept3d'))"))
        p.screenshot(path=str(W/'full-final-auxiliary.png'))
        p.evaluate("heatReconstruction.focus('c100')");p.wait_for_timeout(950)
        check('C100 concept focus',p.evaluate("heatReconstruction.state().scene.selected==='pid:c100'"))
        p.locator('[data-drawing="pid"]').click();check('P&ID selection state synced',p.evaluate("heatReconstruction.state().pidSelected==='hx'"))
        p.evaluate("heatReconstruction.selectPID('oil_pump')")
        check('Concept focus button distinguished','개념' in p.locator('#pid-focus-3d').inner_text())
        check('Concept physical location not claimed','미확인' in p.locator('#component-info').inner_text())
        p.locator('#pid-focus-3d').click();p.wait_for_timeout(950)
        check('P&ID to concept isolated gallery',p.evaluate("heatReconstruction.state().scene.selected==='pid:oil_pump'&&heatReconstruction.state().scene.layer==='aux'"))
        p.locator('[data-drawing="pid"]').click();check('P&ID retains selected item',p.evaluate("heatReconstruction.state().pidSelected==='oil_pump'"))
        p.evaluate("heatReconstruction.selectPID('hx')");p.locator('#pid-focus-3d').click();p.wait_for_timeout(950)
        check('P&ID to physical counterpart',p.evaluate("heatReconstruction.state().scene.selected==='N01'&&heatReconstruction.state().scene.layer==='plant'"))
        for view in ['front','plan','pid']:
            p.locator('[data-drawing="'+view+'"]').click()
            for mode in ['model','source','split']:
                p.locator('[data-view-mode="'+mode+'"]').click()
                check(view+'.'+mode+' state',p.evaluate('heatReconstruction.state().mode')==mode)
                check(view+'.'+mode+' source visibility',p.locator('#drawing-open').is_visible()==(mode!='model'))
            if view=='front':p.screenshot(path=str(W/'full-final-front-compare.png'))
            if view=='plan':p.screenshot(path=str(W/'full-final-plan-compare.png'))
        p.locator('[data-view-mode="model"]').click();p.locator('#pid-fit').click()
        check('P&ID complete glyph count',p.locator('[data-pid-node]').count()==213)
        check('P&ID complete edge count',p.locator('[data-pid-edge]').count()==175)
        check('PID viewport includes every bbox and route',p.evaluate("(()=>{const d=JSON.parse(document.getElementById('reconstruction-data').textContent).pid,b=heatReconstruction.state().pidBounds;return d.components.every(n=>{const[x,y,w,h]=n.sourcePosition.bbox;return x*1160>=b[0]&&y*786>=b[1]&&(x+w)*1160<=b[0]+b[2]&&(y+h)*786<=b[1]+b[3]})&&d.connections.every(e=>e.routePoints.every(([x,y])=>x*1160>=b[0]&&x*1160<=b[0]+b[2]&&y*786>=b[1]&&y*786<=b[1]+b[3]))})()"))
        check('Arrows restricted to confirmed directions',p.evaluate("(()=>{const d=JSON.parse(document.getElementById('reconstruction-data').textContent).pid;return d.connections.every(e=>!!document.querySelector('[data-pid-edge=\"'+e.id+'\"] [marker-end]')===(e.flowDirection==='from-to'))})()"))
        for node in ['c100','fuel_burner','hx','wet_scrubber','hx-recovered-ti','hoist2']:
            check('Select PID '+node,p.evaluate('(id)=>heatReconstruction.selectPID(id)',node))
        p.locator('#pid-fit').click();p.screenshot(path=str(W/'full-final-pid.png'))
        p.locator('#coverage-open').click();check('Survey coverage rows',p.locator('[data-coverage-id]').count()==33)
        p.locator('[data-coverage-focus="P11"]').click();check('Plan-only item opens plan',p.evaluate("heatReconstruction.state().view==='plan'"))
        p.locator('#coverage-open').click();p.locator('[data-coverage-tab="pid"]').click();check('P&ID coverage rows',p.locator('[data-coverage-id]').count()==213)
        p.locator('[data-coverage-tab="routes"]').click();check('Route coverage rows',p.locator('[data-coverage-id]').count()==175);p.keyboard.press('Escape')
        p.locator('[data-drawing="model"]').click();p.locator('#hot-number').fill('90');before=p.evaluate('heatSimulatorState')
        p.locator('#tour-start').click();p.wait_for_timeout(100)
        check('Tour uses presentation mode',p.evaluate('heatPresentationState.active&&heatPresentationState.reporting'))
        p.locator('#tour-next').click();p.locator('#tour-pause').click();check('Tour does not alter model inputs',before==p.evaluate('heatSimulatorState'))
        p.keyboard.press('Escape');check('Escape stops tour',not p.evaluate('heatPresentationState.active'))
        p.locator('#reset').click()
        p.set_viewport_size({'width':1366,'height':768});p.screenshot(path=str(W/'full-final-compact.png'))
        check('Key financial cards in compact viewport',p.locator('.results').bounding_box()['y']+p.locator('.results').bounding_box()['height']<768)
        p.locator('#report-toggle').click();p.screenshot(path=str(W/'full-final-report.png'));check('Report mode assumptions visible',p.locator('.bottom-note').bounding_box()['y']<768)
        p.locator('#report-toggle').click()
        p.set_viewport_size({'width':390,'height':844});check('Mobile no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        p.locator('[data-drawing="pid"]').click();check('Mobile PID no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        p.screenshot(path=str(W/'full-final-mobile-pid.png'))
        check('Seven original byte hashes preserved',p.evaluate("JSON.parse(document.getElementById('embedded-data').textContent).files").__len__()==7)
        for f in p.evaluate("JSON.parse(document.getElementById('embedded-data').textContent).files"):
            check('Original hash '+f['id'],hashlib.sha256(base64.b64decode(f['base64'])).hexdigest()==f['sha256'])
        check('No external requests',not requests,requests)
        check('No JS errors',not errors,errors)
    finally:b.close()
receipt={'checks':len(checks),'passed':all(c['passed'] for c in checks),'details':checks,'finalSHA256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'bytes':OUT.stat().st_size}
(W/'full_scene_qa.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'checks':receipt['checks'],'passed':receipt['passed'],'sha256':receipt['finalSHA256']},ensure_ascii=True))
