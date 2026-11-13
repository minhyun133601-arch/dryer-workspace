from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from evidence_paths import EVIDENCE_ROOT
import json
from playwright.sync_api import sync_playwright

ROOT=EVIDENCE_ROOT
WORK=Path(__file__).resolve().parent
OUT=ROOT/'최종자료'/'건조기 열교환기 시뮬레이터.html'
shots=WORK/'view_qa';shots.mkdir(exist_ok=True)
result={'output':str(OUT),'errors':[],'views':[]}
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    try:
        page=browser.new_page(viewport={'width':1840,'height':1120})
        page.on('pageerror',lambda e:result['errors'].append(str(e)))
        page.goto(OUT.as_uri(),wait_until='load',timeout=30000)
        page.wait_for_timeout(300)
        result['initial']=page.evaluate('({state:window.heatReconstruction?.state?.(),coverage:window.heatReconstruction?.coverage})')
        for view in ['front','plan']:
            for mode in ['split','model']:
                page.evaluate('([v,m])=>{window.heatReconstruction.setView(v);window.heatReconstruction.setMode(m)}',[view,mode])
                page.wait_for_timeout(300)
                file=shots/(view+'-'+mode+'.png')
                page.screenshot(path=str(file),full_page=False)
                result['views'].append({'view':view,'mode':mode,'screenshot':str(file),'state':page.evaluate('window.heatReconstruction.state()')})
        result['visibleText']=page.locator('body').inner_text()[:8000]
    finally:
        browser.close()
(shots/'receipt.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k not in ['initial','views','visibleText']},ensure_ascii=False))
