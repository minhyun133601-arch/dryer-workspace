from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
SOURCE=next((ROOT/'references/guardhouse-team2-20261112/source').glob('*.mp4'))
FRAMES=OUT/'frames'; FRAMES.mkdir(parents=True,exist_ok=True)
TIMES=list(range(0,146,2))
def extract(t):
    target=FRAMES/f'frame-{t:03d}s.jpg'
    if not target.exists():
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(t),'-i',str(SOURCE),'-frames:v','1','-vf','scale=540:-2','-q:v','3','-threads','1','-y',str(target)],check=True)
    return target
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(extract,TIMES))
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
for start in range(0,len(TIMES),16):
    group=TIMES[start:start+16]
    sheet=Image.new('RGB',(960,1832),'#e5ede9'); draw=ImageDraw.Draw(sheet)
    for i,t in enumerate(group):
        im=Image.open(FRAMES/f'frame-{t:03d}s.jpg'); im.thumbnail((236,424))
        x=(i%4)*240+(240-im.width)//2; y=(i//4)*458
        sheet.paste(im,(x,y));draw.text(((i%4)*240+8,y+427),f'{t//60:02}:{t%60:02} / {t}s',font=font,fill='#15362c')
    sheet.save(OUT/f'contact-{group[0]:03d}-{group[-1]:03d}s.jpg',quality=90)
(OUT/'index.json').write_text(json.dumps({'source':str(SOURCE.relative_to(ROOT)),'rangeSeconds':[0,145],'stepSeconds':2,'sampledSeconds':TIMES,'method':'ffmpeg input seek with display rotation; 540px wide review frames; original untouched'},ensure_ascii=False,indent=2),encoding='utf8')
print(f'Created {len(TIMES)} frames and {(len(TIMES)+15)//16} contact sheets')
