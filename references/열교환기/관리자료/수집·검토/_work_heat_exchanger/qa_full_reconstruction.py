"""Feature-level verification for the self-contained reconstruction artifact."""
from pathlib import Path
from evidence_paths import EVIDENCE_ROOT
import base64
import hashlib
import json
import math
from playwright.sync_api import sync_playwright

WORK = Path(__file__).resolve().parent
ROOT = EVIDENCE_ROOT
OUT = ROOT / '최종자료' / '건조기 열교환기 시뮬레이터.html'
model = json.loads((WORK / 'simulator_model.json').read_text('utf8'))
loaded_hash = hashlib.sha256(OUT.read_bytes()).hexdigest()
checks = []


def check(name, ok, detail=None):
    checks.append({'name': name, 'passed': bool(ok), 'detail': detail})
    if not ok:
        raise AssertionError((name, detail))


with sync_playwright() as pw:
    browser = pw.chromium.launch(
        executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    context = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 900})
    page = context.new_page()
    errors, outside = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: outside.append(r.url) if r.url.startswith(('http://', 'https://')) else None)
    page.goto(OUT.as_uri(), wait_until='load')
    page.wait_for_function('window.heat3DReady === true && !!window.heatReconstruction')
    check('WebGL initialized', page.evaluate('window.heat3DReady === true'))
    check('no duplicate DOM IDs', page.locator('[id]').evaluate_all(
        '(es)=>new Set(es.map(e=>e.id)).size===es.length'))

    for case in model['cases']:
        inp, expected = case['inputs'], case['expected']
        page.locator('#reset').click()
        page.locator('#advanced-open').click()
        for key, id in [('coldMassKgH', 'cold-flow'), ('hotMassKgH', 'hot-flow'),
                        ('gasPriceKRWm3', 'gas-price'), ('hoursPerDay', 'hours'), ('daysPerYear', 'days')]:
            page.locator('#' + id).fill(str(inp[key]))
        page.locator('#capex').fill(str(inp['investmentKRW'] / 10000))
        page.keyboard.press('Escape')
        for key, id, factor in [('coldInC', 'tin-number', 1), ('hotInC', 'hot-number', 1),
                                ('effectiveness', 'epsilon-number', 100)]:
            page.locator('#' + id).fill(str(inp[key] * factor))
        actual = page.evaluate('window.heatSimulatorState')
        for key, expected_key in [('Q', 'heatKW'), ('coldOut', 'coldOutC'), ('hotOut', 'hotOutC'),
                                  ('gas', 'gasSavingM3h'), ('annual', 'annualGrossGasSavingKRW'),
                                  ('payback', 'grossSimplePaybackYears')]:
            value = expected[expected_key]
            passed = actual[key] is None if value is None else math.isclose(actual[key], value, rel_tol=1e-10, abs_tol=1e-7)
            check(case['name'] + '.' + key, passed, {'actual': actual[key], 'expected': value})

    page.locator('#reset').click()
    check('baseline money visible', page.locator('#annual-exact').inner_text().startswith('277,992,000'))
    check('baseline payback visible', page.locator('#payback-output').inner_text() == '2.60')
    check('expected capital visible', page.locator('#investment-output').inner_text() == '7.24')
    page.locator('#tin-number').fill('')
    check('empty temperature rejected', page.locator('#input-error').is_visible())
    page.locator('#reset').click()
    page.locator('#epsilon-number').fill('101')
    check('invalid effectiveness rejected', page.locator('#input-error').is_visible())
    page.locator('#reset').click()
    page.locator('#advanced-open').click()
    page.locator('#cold-flow').fill('0')
    check('zero mass flow rejected', page.locator('#input-error').is_visible())
    page.locator('#cold-flow').fill('55000')
    page.locator('#delta-kw').fill('50')
    page.locator('#electricity-price').fill('150')
    page.locator('#maintenance').fill('500')
    check('net saving scenario', page.locator('#net-output').inner_text() == '21,899.2만원/년')
    page.locator('#delta-kw').fill('')
    check('unknown power preserved', page.locator('#net-output').inner_text() == '미산정')
    page.keyboard.press('Escape')
    page.locator('#reset').click()

    # Source payloads are preserved byte for byte, with no network dependency.
    original = json.loads((WORK / 'oneglance_receipt.json').read_text('utf8'))
    page.locator('#evidence-open').click()
    for file in original['files']:
        with page.expect_download() as download:
            page.locator('[data-file="' + file['id'] + '"]').click()
        payload = Path(download.value.path()).read_bytes()
        check('original download ' + file['name'], hashlib.sha256(payload).hexdigest() == file['sha256'])
    page.keyboard.press('Escape')

    # The embedded catalog and survey must match the independently reviewed source data.
    embedded = page.locator('#reconstruction-data').text_content()
    reconstruction = json.loads(embedded)
    survey = json.loads((WORK / 'full_reconstruction/front_plan_survey.json').read_text('utf8'))
    pid = json.loads((WORK / 'full_reconstruction/pid_catalog.json').read_text('utf8'))
    check('survey embedded without changes', reconstruction['survey'] == survey)
    check('P&ID embedded without changes', reconstruction['pid'] == pid)
    for id in ('front', 'plan'):
        data_url = reconstruction['vectors'][id]
        check(id + ' source is vector SVG', data_url.startswith('data:image/svg+xml'))
        payload = base64.b64decode(data_url.split(',', 1)[1])
        check(id + ' original SVG bytes', payload == (WORK / 'full_reconstruction/source_assets' / (id + '.svg')).read_bytes())
    objects = page.evaluate('Object.keys(window.heatReconstructionScene.groups)')
    check('all surveyed items retained', all(i['id'] in objects for i in survey['items']), objects)
    check('all surveyed ducts retained', all(i['id'] in objects for i in survey['ductSurvey'] if i['id'] != 'D07'), objects)
    for id in ('E04', 'P02'):
        check(id + ' ambiguous item has no fabricated solid', page.evaluate(
            '(id)=>!window.heatReconstructionScene.groups[id].children.some(o=>o.isMesh)', id))
    dryer = page.evaluate('window.heatReconstructionScene.groups.E01.children.filter(o=>o.geometry?.type==="CylinderGeometry").map(o=>o.geometry.parameters)')
    check('long dryer cone follows source profile', any(math.isclose(p['height'], 8.934, abs_tol=.05) and p['radiusTop'] > 4 and p['radiusBottom'] < .6 for p in dryer), dryer)
    check('dryer cylinder follows source profile', any(math.isclose(p['height'], 5.935, abs_tol=.05) and math.isclose(p['radiusTop'], 4.2, abs_tol=.03) for p in dryer), dryer)

    custom = page.evaluate('window.heatSimulatorState')
    for view in ('front', 'plan'):
        page.locator('[data-drawing="' + view + '"]').click()
        check(view + ' orthographic view', page.evaluate('window.heatReconstruction.state().scene.view') == view)
        for mode in ('split', 'source', 'model'):
            page.locator('[data-view-mode="' + mode + '"]').click()
            check(view + ' mode ' + mode, page.evaluate('window.heatReconstruction.state().mode') == mode)
            check(view + ' source visibility ' + mode, page.locator('#drawing-open').is_visible() == (mode != 'model'))
            check(view + ' model visibility ' + mode, page.locator('#model-stage').is_visible() == (mode != 'source'))
        page.locator('[data-view-mode="split"]').click()
        page.screenshot(path=str(WORK / ('full-reconstruction-' + view + '-split.png')), full_page=True)
    check('view changes preserve thermal inputs', page.evaluate('window.heatSimulatorState') == custom)
    page.locator('[data-drawing="pid"]').click()
    check('all P&ID node symbols rendered', page.locator('[data-pid-node]').count() == len(pid['components']))
    check('all P&ID connection lines rendered', page.locator('[data-pid-edge]').count() == len(pid['connections']))
    check('complete P&ID inside viewBox', page.evaluate('''()=>{const s=document.getElementById('pid-svg'), v=s.viewBox.baseVal,b=document.getElementById('pid-graph').getBBox();return b.x>=v.x&&b.y>=v.y&&b.x+b.width<=v.x+v.width&&b.y+b.height<=v.y+v.height}'''))
    page.evaluate('window.heatReconstruction.selectPID("hx")')
    connected = [e for e in pid['connections'] if e['from'] == 'hx' or e['to'] == 'hx']
    check('P&ID selection state', page.evaluate('window.heatReconstruction.state().pidSelected') == 'hx')
    check('P&ID connected lines highlighted', page.locator('[data-pid-edge].selected').count() == len(connected))
    check('P&ID unrelated lines faded', page.locator('[data-pid-edge].faded').count() == len(pid['connections']) - len(connected))
    check('P&ID known location links to 3D', page.locator('#pid-focus-3d').is_visible())
    page.locator('#pid-focus-3d').click()
    page.wait_for_timeout(900)
    check('P&ID link focuses surveyed core', page.evaluate('window.heatReconstruction.state().scene.selected') == 'N01')
    page.locator('[data-drawing="pid"]').click()
    page.evaluate('window.heatReconstruction.selectPID("oil_pump")')
    check('pump concept is labeled separately', '개념' in page.locator('#pid-focus-3d').inner_text())
    check('pump installation location status visible', '미확인' in page.locator('#component-info').inner_text())
    page.locator('#pid-focus-3d').click()
    page.wait_for_timeout(900)
    check('concept uses separate display layer', page.evaluate('window.heatReconstruction.state().scene.layer') == 'aux')
    check('concept does not occupy actual plant layout', page.evaluate('!window.heatReconstructionScene.groups.E01.visible && !window.heatReconstructionScene.groups.N01.visible'))
    check('concept placement disclaimer visible', page.locator('#aux-caption').is_visible())
    page.screenshot(path=str(WORK / 'full-reconstruction-aux-focus.png'), full_page=True)
    page.locator('[data-focus="aux"]').click()
    check('auxiliary gallery available', page.evaluate('window.heatReconstruction.state().scene.auxiliary') > 0)
    page.wait_for_function('''()=>[...document.querySelectorAll('.aux-label')].every(e=>getComputedStyle(e).visibility==='visible')''')
    check('all auxiliary labels visible', page.locator('.aux-label').count() == page.evaluate('window.heatReconstruction.state().scene.auxiliary'))
    check('auxiliary gallery labels inside viewport', page.evaluate('''()=>{const r=document.getElementById('model-stage').getBoundingClientRect();return [...document.querySelectorAll('.aux-label')].every(e=>{const b=e.getBoundingClientRect();return b.x>=r.x&&b.right<=r.right&&b.y>=r.y&&b.bottom<=r.bottom})}'''))
    check('unconfirmed fan tag not replaced by internal ID', page.locator('[data-component="pid:c300"]').inner_text() != 'c300')
    page.screenshot(path=str(WORK / 'full-reconstruction-aux-gallery.png'), full_page=True)
    page.locator('#view-iso').click()
    check('overview restores actual plant layer', page.evaluate('window.heatReconstruction.state().scene.layer') == 'plant')
    page.locator('[data-drawing="pid"]').click()
    check('P&ID selection and summary stay synchronized', page.evaluate('window.heatReconstruction.state().pidSelected') == 'oil_pump' and '오일' in page.locator('#component-name').inner_text())
    page.evaluate('window.heatReconstruction.selectPID("feed-ls")')
    check('unlocated instrument has no fabricated 3D position', page.locator('#pid-focus-3d').is_hidden())
    page.locator('#pid-zoom-in').click()
    check('P&ID zoom works', page.evaluate('window.heatReconstruction.state().pidScale') > 1)
    page.locator('#pid-fit').click()
    check('P&ID fit resets zoom', page.evaluate('window.heatReconstruction.state().pidScale') == 1)
    page.locator('#pid-instruments').uncheck()
    check('P&ID instrument layer toggles', page.locator('#pid-svg').evaluate('(e)=>e.classList.contains("hide-instruments")'))
    page.locator('#pid-instruments').check()
    for mode in ('split', 'source', 'model'):
        page.locator('[data-view-mode="' + mode + '"]').click()
        check('P&ID mode ' + mode, page.evaluate('window.heatReconstruction.state().mode') == mode)
        check('P&ID source visibility ' + mode, page.locator('#drawing-open').is_visible() == (mode != 'model'))
        check('P&ID digital visibility ' + mode, page.locator('#pid-panel').is_visible() == (mode != 'source'))
    page.screenshot(path=str(WORK / 'full-reconstruction-pid.png'), full_page=True)
    page.locator('#coverage-open').click()
    check('survey coverage rows', page.locator('[data-coverage-id]').count() == len(survey['items']))
    page.locator('[data-coverage-tab="pid"]').click()
    check('P&ID coverage rows', page.locator('[data-coverage-id]').count() == len(pid['components']))
    page.locator('[data-coverage-tab="routes"]').click()
    check('connection coverage rows', page.locator('[data-coverage-id]').count() == len(pid['connections']))
    page.locator('#coverage-close').click()
    page.locator('[data-drawing="model"]').click()
    before = page.evaluate('window.heatReconstruction.state().scene.yaw')
    canvas = page.locator('#model-canvas').bounding_box()
    page.mouse.move(canvas['x'] + canvas['width'] * .2, canvas['y'] + canvas['height'] * .7)
    page.mouse.down()
    page.mouse.move(canvas['x'] + canvas['width'] * .2 + 100, canvas['y'] + canvas['height'] * .7 - 20, steps=6)
    page.mouse.up()
    check('3D camera drag rotates', abs(page.evaluate('window.heatReconstruction.state().scene.yaw') - before) > .1)
    page.locator('#view-iso').click()
    page.wait_for_timeout(950)
    check('3D overview resets camera', math.isclose(page.evaluate('window.heatReconstruction.state().scene.yaw'), before, abs_tol=.02))
    page.locator('#report-toggle').click()
    check('report mode', page.locator('body').evaluate('(e)=>e.classList.contains("presentation")'))
    check('report hides controls', page.locator('.controls').is_hidden())
    page.screenshot(path=str(WORK / 'full-reconstruction-report.png'), full_page=True)
    page.locator('#report-toggle').click()
    page.locator('#tin-number').fill('25')
    page.locator('#hot-number').fill('90')
    page.locator('#epsilon-number').fill('65')
    custom = page.evaluate('window.heatSimulatorState')
    page.locator('#tour-start').click()
    page.locator('#tour-pause').click()
    check('tour pauses', not page.evaluate('window.heatPresentationState.playing'))
    for i in range(1, 5):
        page.locator('#tour-next').click()
        check('tour step ' + str(i), page.evaluate('window.heatPresentationState.index') == i)
        check('tour preserves inputs ' + str(i), page.evaluate('window.heatSimulatorState') == custom)
    page.keyboard.press('Escape')
    check('tour escape exits', not page.evaluate('window.heatPresentationState.active'))
    page.locator('#reset').click()
    page.locator('#view-iso').click()
    page.wait_for_timeout(950)
    state = page.evaluate('window.heatReconstruction.state()')
    page.screenshot(path=str(WORK / 'full-reconstruction-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 1366, 'height': 768})
    page.wait_for_timeout(100)
    bounds = page.locator('.results').bounding_box()
    check('compact screen money visible', bounds['y'] + bounds['height'] <= 768, bounds)
    page.screenshot(path=str(WORK / 'full-reconstruction-compact.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(100)
    check('mobile no page overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.screenshot(path=str(WORK / 'full-reconstruction-mobile.png'), full_page=True)
    check('no JavaScript errors', not errors, errors)
    check('no external runtime requests', not outside, outside)
    check('artifact unchanged during verification', hashlib.sha256(OUT.read_bytes()).hexdigest() == loaded_hash)
    browser.close()

receipt = {'output': str(OUT), 'bytes': OUT.stat().st_size,
           'sha256': hashlib.sha256(OUT.read_bytes()).hexdigest(),
           'checks': checks, 'errors': errors, 'outsideRequests': outside,
           'reconstructionState': state}
(WORK / 'full_reconstruction_qa.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), 'utf8')
print(json.dumps({'passed': len(checks), 'output': str(OUT)}, ensure_ascii=False))
