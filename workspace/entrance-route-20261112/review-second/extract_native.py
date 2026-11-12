from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess
ROOT=Path(__file__).resolve().parents[3]
source=next((ROOT/'references/guardhouse-team2-20261112/source').glob('*.mp4'),None) or next((ROOT/'경비실 ~ 2팀 입구').glob('*.mp4'))
out=Path(__file__).resolve().parent/'native';out.mkdir(exist_ok=True)
times=[140,144,158,160,166,168,170,176,184,194,198,204,206,210,212,220,222,224,226,228,230,232,236,240,242,244,248,250,254,256,266,270,274,278,280,282,284,286]
def extract(t):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(t),'-i',str(source),'-frames:v','1','-q:v','2','-threads','1','-y',str(out/f'frame-{t:03d}s.jpg')],check=True)
with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(extract,times))
print('native',len(times))
