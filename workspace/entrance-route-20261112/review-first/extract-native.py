from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent/'native';OUT.mkdir(exist_ok=True)
SOURCE=next((ROOT/'references/guardhouse-team2-20261112/source').glob('*.mp4'))
TIMES=[2,8,12,20,28,36,46,54,64,68,80,96,104,122,130,136,140,144]
def extract(t):
    target=OUT/f'frame-{t:03d}s.jpg'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(t),'-i',str(SOURCE),'-frames:v','1','-q:v','2','-threads','1','-y',str(target)],check=True)
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(extract,TIMES))
print('Native frames: '+str(TIMES))
