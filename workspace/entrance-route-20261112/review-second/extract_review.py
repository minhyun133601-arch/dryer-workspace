from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageDraw,ImageFont
import subprocess,json
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
SOURCE=next((ROOT/'references/guardhouse-team2-20261112/source').glob('*.mp4'),None) or next((ROOT/'경비실 ~ 2팀 입구').glob('*.mp4'))
FRAMES=OUT/'frames';FRAMES.mkdir(exist_ok=True)
times=list(range(140,289,2))
def extract(t):
    path=FRAMES/f'frame-{t:03d}s.jpg'
    if not path.exists():subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(t if t<288 else 287.9),'-i',str(SOURCE),'-frames:v','1','-vf','scale=540:-2','-q:v','3','-threads','1','-y',str(path)],check=True)
with ThreadPoolExecutor(max_workers=4) as p:list(p.map(extract,times))
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
for start in range(0,len(times),16):
    batch=times[start:start+16];sheet=Image.new('RGB',(960,1840),'#e9eee9');d=ImageDraw.Draw(sheet)
    for i,t in enumerate(batch):
        im=Image.open(FRAMES/f'frame-{t:03d}s.jpg');im.thumbnail((238,426));x=i%4*240;y=i//4*460;sheet.paste(im,(x+(240-im.width)//2,y));d.text((x+8,y+432),f'{t//60}:{t%60:02d} ({t}s)',font=font,fill='#163e30')
    sheet.save(OUT/f'contact-{batch[0]:03d}-{batch[-1]:03d}.jpg',quality=90)
(OUT/'index.json').write_text(json.dumps({'source':str(SOURCE.relative_to(ROOT)),'intervalSeconds':2,'times':times,'rotation':'ffmpeg automatic display rotation -90','frames':str(FRAMES.relative_to(ROOT))},ensure_ascii=False,indent=2),encoding='utf8')
print('Extracted',len(times),'frames')
