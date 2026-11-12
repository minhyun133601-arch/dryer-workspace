from pathlib import Path
import json,math
ROOT=Path(__file__).resolve().parents[3]
p=next((ROOT/'references/guardhouse-team2-20261112/source').glob('*.txt'),None) or next((ROOT/'경비실 ~ 2팀 입구').glob('*.txt'))
samples=[]
for line in p.read_text(encoding='utf8').splitlines():
    if not line.startswith('{'):continue
    try:r=json.loads(line)
    except ValueError:continue
    if 'video_time_ms'in r:samples.append(r)
out=[]
for t in [220,226,232,234,237,244,250,254,256,258,260,262,264,266,268,270,272,274,276,278,280,282,284,286,288]:
    r=min(samples,key=lambda r:abs(r['video_time_ms']/1000-t));g=r['geolocation'];d=r['camera_direction'];out.append({'second':t,'sampleSecond':round(r['video_time_ms']/1000,2),'lat':g.get('latitude_degrees'),'lon':g.get('longitude_degrees'),'heading':round(d.get('heading_degrees',0),1),'pitch':round(d.get('pitch_degrees',0),1),'accuracy':g.get('horizontal_accuracy_m')})
print(json.dumps(out,ensure_ascii=False,indent=2))
(Path(__file__).parent/'motion-gps-samples.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
