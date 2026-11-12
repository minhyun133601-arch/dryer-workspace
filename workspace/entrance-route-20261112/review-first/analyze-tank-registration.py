from pathlib import Path
import json,math,subprocess
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent/'tank-position-review';OUT.mkdir(exist_ok=True)
source=next((ROOT/'references/guardhouse-team2-20261112/source').glob('*.mp4'))
def extract(t):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(t),'-i',str(source),'-frames:v','1','-q:v','2','-threads','1','-y',str(OUT/f'frame-{t:03d}s.jpg')],check=True)
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(extract,[172,174,178,180,182,186]))
text=next((ROOT/'references/guardhouse-team2-20261112/source').glob('*.txt')).read_text(encoding='utf8')
observations=[json.loads(line) for line in text.split('=== 시간별 원본 관측 JSONL ===')[1].splitlines() if line.startswith('{')]
rows=[]
for t in [68,80,96,108,126,130,172,174,178,180,182,186]:
    r=min(observations,key=lambda r:abs(r.get('video_time_ms',0)/1000-t));g=r['geolocation'];c=r['camera_direction'];n=(g['latitude_degrees']-35.36269436)*111320;e=(g['longitude_degrees']-129.03104166)*111320*math.cos(math.radians(35.36269436));x=n*math.cos(math.radians(325.4))+e*math.sin(math.radians(325.4));z=n*math.cos(math.radians(55.4))+e*math.sin(math.radians(55.4));head=c['heading_degrees'];dx=math.cos(math.radians(head-325.4));dz=math.cos(math.radians(head-55.4));travel=(-76.5-z)/dz;cross=x+dx*travel
    rows.append({'targetSeconds':t,'actualSeconds':r['video_time_ms']/1000,'x':round(x,2),'z':round(z,2),'heading':round(head,1),'accuracy':round(g['horizontal_accuracy_m'],1),'rayXAtBundFrontZminus76p5':round(cross,2)})
print(json.dumps(rows,indent=2))
(OUT/'camera-bearings.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
aerial=Image.open(ROOT.parent/'삭제 예정/프로젝트_자료정리_20261112/references/yusan-campus/yusan-surroundings.jpg').convert('RGB');draw=ImageDraw.Draw(aerial)
def pix(x,z):return (755+(-.568*x+.823*z)/.31943717636358054,455+(-.823*x-.568*z)/.31943717636358054)
for bounds,color in [((56.2,71,-90.5,-76.5),'#ff3434'),((47.2,62,-90.5,-76.5),'#ffff00'),((37.5,47.5,-88.5,-77),'#00ffff')]:
    x0,x1,z0,z1=bounds;points=[pix(x0,z0),pix(x1,z0),pix(x1,z1),pix(x0,z1)];draw.line(points+[points[0]],fill=color,width=2)
crop=aerial.crop((340,330,535,545)).resize((780,860))
crop.save(OUT/'aerial-current-red-shift9-yellow-office-cyan.png')
