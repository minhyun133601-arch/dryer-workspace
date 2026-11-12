from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageDraw,ImageFont
import subprocess,json
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent/'entry-motion';OUT.mkdir(exist_ok=True)
SOURCE=next((ROOT/'references/guardhouse-team2-20261112/source').glob('*.mp4'),None) or next((ROOT/'경비실 ~ 2팀 입구').glob('*.mp4'))
times=[260+i*.5 for i in range(57)]
def extract(t):
    target=OUT/f'frame-{t:06.2f}s.jpg'
    if not target.exists():subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(min(t,287.9)),'-i',str(SOURCE),'-frames:v','1','-q:v','2','-threads','1','-y',str(target)],check=True)
with ThreadPoolExecutor(max_workers=4) as p:list(p.map(extract,times))
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
for start in range(0,len(times),16):
    batch=times[start:start+16];sheet=Image.new('RGB',(960,1840),'#e9eee9');d=ImageDraw.Draw(sheet)
    for i,t in enumerate(batch):
        im=Image.open(OUT/f'frame-{t:06.2f}s.jpg');im.thumbnail((238,426));x=i%4*240;y=i//4*460;sheet.paste(im,(x+(240-im.width)//2,y));d.text((x+8,y+432),f'{t:.2f}s',font=font,fill='#163e30')
    sheet.save(OUT/f'contact-{batch[0]:06.2f}-{batch[-1]:06.2f}.jpg',quality=90)
print('motion',len(times))
