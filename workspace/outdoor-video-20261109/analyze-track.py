import csv
import math
from pathlib import Path
from PIL import Image, ImageDraw

folder = Path(__file__).parent
rows = list(csv.DictReader(next(folder.glob('*.gps.csv')).open(encoding='utf-8-sig')))
yaw = math.radians(35)
observations = []
for r in rows:
    t = float(r['video_time_ms']) / 1000
    if t < 0 or r['gps_status'] != 'valid':
        continue
    x = (float(r['longitude_degrees']) - 129.031) * 111320 * math.cos(math.radians(35.362)) + 13.92
    z = (35.362 - float(r['latitude_degrees'])) * 111320 - 13.92
    u = x * math.cos(yaw) - z * math.sin(yaw)
    v = x * math.sin(yaw) + z * math.cos(yaw)
    observations.append((t, u, v, float(r['horizontal_accuracy_m']), float(r['heading_degrees'])))
last = -1
for t, u, v, acc, heading in observations:
    if int(t)//15 == last:
        continue
    last = int(t)//15
    print(f'{t:6.1f}s u={u:5.1f} v={v:5.1f} acc={acc:.1f}m heading={heading:.0f}')
out = Image.new('RGB', (1600, 650), '#172026')
d = ImageDraw.Draw(out)
project = lambda u, v: (60+u*20, 350+v*20)
for u in range(0, 76, 5):
    d.line([project(u, -14), project(u, 12)], fill='#31434d')
    d.text(project(u, -15), str(u), fill='white')
for v in range(-12, 13, 2):
    d.line([project(0, v), project(75, v)], fill='#31434d')
    d.text(project(-2, v), str(v), fill='white')
d.line([project(u,v) for _,u,v,_,_ in observations], fill='#4ad7dd', width=2)
last = -1
for t,u,v,acc,heading in observations:
    if int(t)//15 == last:
        continue
    last = int(t)//15
    p=project(u,v)
    d.ellipse((p[0]-3,p[1]-3,p[0]+3,p[1]+3),fill='orange')
    d.text((p[0]+4,p[1]-12), str(round(t)), fill='white')
out.save(folder/'gps-route.png')
