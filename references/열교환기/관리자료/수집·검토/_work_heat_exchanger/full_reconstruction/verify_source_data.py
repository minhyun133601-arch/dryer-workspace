"""Independent structural checks for the drawing survey and transcribed P&ID."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import math

HERE = Path(__file__).resolve().parent
survey = json.loads((HERE / 'front_plan_survey.json').read_text('utf-8'))
pid = json.loads((HERE / 'pid_catalog.json').read_text('utf-8'))
checks = []


def check(name, condition, detail=None):
    checks.append({'name': name, 'passed': bool(condition), 'detail': detail})
    if not condition:
        raise AssertionError((name, detail))


for name, values in [('survey', survey['items']), ('P&ID', pid['components']),
                     ('connections', pid['connections']), ('ducts', survey['ductSurvey'])]:
    check(name + ' IDs unique', len(values) == len({v['id'] for v in values}), len(values))

ids = {c['id'] for c in pid['components']}
check('all connection endpoints exist', all(e['from'] in ids and e['to'] in ids for e in pid['connections']))
check('all node source coordinates normalized', all(
    0 <= c['sourcePosition'][k] <= 1 for c in pid['components'] for k in ('x', 'y')))
check('all route coordinates normalized', all(
    0 <= value <= 1 for e in pid['connections'] for point in e['routePoints'] for value in point))
check('all survey coordinates finite or explicitly unknown', all(
    v is None or isinstance(v, (int, float)) and math.isfinite(v)
    for item in survey['items'] for v in item['center']))

for id in ('E01', 'E11', 'E12', 'E13', 'N01', 'E20', 'E21'):
    item = next(i for i in survey['items'] if i['id'] == id)
    f, p = survey['coordinateSystem']['front'], survey['coordinateSystem']['plan']
    fx = (item['frontAnchorPt'][0] - f['processXDatumPt']) * f['mmPerPdfPoint'] / 1000
    px = (item['planAnchorPt'][0] - p['processXDatumPt']) * p['mmPerPdfPoint'] / 1000
    check(id + ' major equipment x registration within 0.10m', abs(fx - px) <= .10,
          {'frontXM': fx, 'planXM': px, 'differenceM': abs(fx - px)})

check('survey total agrees with coverage', len(survey['items']) == survey['coverage']['equipmentOrRegions'])
check('P&ID total agrees with coverage', len(pid['components']) == pid['coverage']['components'])
check('P&ID connections agree with coverage', len(pid['connections']) == pid['coverage']['connections'])
check('P&ID does not claim fabrication completeness', pid['coverage']['completeClaim'] is False)
for id in ('E04', 'P02'):
    warnings = survey['coverage']['frontPlanCorrespondenceWarnings']
    check(id + ' ambiguous correspondence retained', any(w['id'] == id for w in warnings))

source_hashes = {}
for filename in ('front_plan_survey.json', 'pid_catalog.json', 'source_assets/front.svg', 'source_assets/plan.svg'):
    payload = (HERE / filename).read_bytes()
    source_hashes[filename] = {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}

result = {
    'status': 'passed', 'checks': checks,
    'surveyItems': len(survey['items']), 'ductRoutes': len(survey['ductSurvey']),
    'pidComponents': len(pid['components']), 'pidConnections': len(pid['connections']),
    'pidConfidence': dict(Counter(c['confidence'] for c in pid['components'])),
    'sourceHashes': source_hashes,
    'scope': 'Data structure and cross-view coordinate registration; visual fidelity is reviewed separately.'
}
(HERE / 'source_integrity.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf-8')
print(json.dumps({'passed': len(checks), 'surveyItems': len(survey['items']),
                  'pidComponents': len(pid['components']), 'pidConnections': len(pid['connections'])}))
