from pathlib import Path
from evidence_paths import EVIDENCE_ROOT, FINAL_DIR
import hashlib
import json
import re
from playwright.sync_api import sync_playwright

ROOT = EVIDENCE_ROOT
WORK = Path(__file__).resolve().parent
OUT = FINAL_DIR / '열교환기 백데이터.html'
receipt = json.loads((WORK/'html_receipt.json').read_text(encoding='utf-8'))
checks = []
def check(name, ok, detail=''):
    assert ok, (name,detail)
    checks.append({'name':name,'passed':True,'detail':detail})

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
    context = browser.new_context(accept_downloads=True,viewport={'width':1500,'height':1100})
    page = context.new_page()
    errors,requests=[],[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http://','https://')) else None)
    page.goto(OUT.as_uri(),wait_until='load')
    def val(id): return page.locator('#'+id).inner_text()
    def fill(values):
        for key,value in values.items(): page.locator('#'+key).fill(str(value))
    check('default gross',val('gross-output')=='27,799.2만원/년',val('gross-output'))
    check('default ROI',val('gross-payback')=='2.60년',val('gross-payback'))
    check('default net unknown',val('net-output')=='미산정' and val('net-payback')=='미산정')
    fill({'delta-kw':0,'electricity-price':150})
    check('zero kW is valid',val('net-output')=='27,799.2만원/년' and val('net-payback')=='2.60년')
    fill({'delta-kw':50,'maintenance':500})
    check('50kW 150KRW 5M maintenance',val('net-output')=='21,899.2만원/년' and val('net-payback')=='3.31년')
    fill({'delta-kw':-20,'maintenance':0})
    check('negative kW saving',val('net-output')=='29,959.2만원/년' and val('net-payback')=='2.42년')
    fill({'delta-kw':200,'electricity-price':200})
    check('negative net no positive payback',val('net-output')=='-1,000.8만원/년' and val('net-payback')=='회수 불가')
    page.locator('#reset').click()
    fill({'days':250})
    check('250 days',val('gross-output')=='23,166만원/년' and val('gross-payback')=='3.13년')
    fill({'hours':0})
    check('zero hours rejected',not page.locator('#calc-error').is_hidden() and val('gross-output')=='입력 확인')
    fill({'hours':24,'days':366})
    check('366 days rejected',not page.locator('#calc-error').is_hidden())
    fill({'days':300,'gas-price':0})
    check('zero gas price rejected',not page.locator('#calc-error').is_hidden())
    page.locator('#reset').click()
    fill({'delta-kw':'','electricity-price':150})
    check('blank delta never zero',val('net-output')=='미산정')
    page.locator('#reset').click()
    image=page.locator('.source-image').first
    image.click()
    check('viewer opens',page.locator('#viewer').is_visible())
    page.keyboard.press('Escape')
    check('Escape closes',not page.locator('#viewer').is_visible())
    check('focus restored',image.evaluate('(el)=>document.activeElement===el'))
    downloads=WORK/'qa_downloads';downloads.mkdir(exist_ok=True)
    for f in receipt['embeddedFiles']:
        with page.expect_download() as dl:
            page.locator(f'[data-file="{f["id"]}"]').click()
        download=dl.value
        p=downloads/f['name'];download.save_as(p)
        check('embedded original '+f['name'],hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],str(p.stat().st_size))
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(WORK/'html-desktop.png'))
    check('desktop no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(WORK/'html-mobile.png'))
    check('mobile no body overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.locator('#calculator').scroll_into_view_if_needed()
    page.screenshot(path=str(WORK/'html-mobile-calc.png'))
    check('no external requests',not requests,requests)
    check('no JS errors',not errors,errors)
    browser.close()
(WORK/'html_qa.json').write_text(json.dumps({'output':str(OUT),'checks':checks,'status':'passed'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'status':'passed'},ensure_ascii=False))
