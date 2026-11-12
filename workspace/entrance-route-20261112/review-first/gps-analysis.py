import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
manifest=json.loads((ROOT/'references/guardhouse-team2-20261112/source-manifest.json').read_text(encoding='utf8'))
rows=[]
for record in manifest['gps']['samplesEvery10Seconds']:
    north=(record['latitude']-35.36269436)*111320
    east=(record['longitude']-129.03104166)*111320*math.cos(math.radians(35.36269436))
    x=north*math.cos(math.radians(325.4))+east*math.sin(math.radians(325.4))
    z=north*math.cos(math.radians(55.4))+east*math.sin(math.radians(55.4))
    rows.append({**record,'campusX':round(x,3),'campusZ':round(z,3)})
print('sec      X       Z     heading  accuracy')
for r in rows:
    print('{:6.1f} {:7.2f} {:7.2f} {:7.1f} {:5.1f}'.format(r['seconds'],r['campusX'],r['campusZ'],r['headingDegrees'],r['accuracyMetres']))
(Path(__file__).resolve().parent/'gps-campus-samples.json').write_text(json.dumps({'method':'equirectangular local projection onto campus datum; phone path only, not structure coordinates','samples':rows},ensure_ascii=False,indent=2),encoding='utf8')
