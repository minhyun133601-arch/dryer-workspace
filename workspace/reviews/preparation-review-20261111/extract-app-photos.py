from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess, re, json, hashlib
root=Path(__file__).resolve().parents[3]
source=next((root/'조제실').glob('*.mp4'))
data=(root/'apps/site/preparation-data.js').read_text(encoding='utf-8')
seconds={15,39,47,51,57,76,78,87,105,135,165,177,189,236,291,321,363,411,483,486,492,506,519}
for match in re.finditer(r'observed\(\[([^\]]+)\]|\}, \[([^\]]+)\]',data):
    seconds.update(int(x) for x in re.findall(r'\d+',match.group(1) or match.group(2)))
target=root/'apps/site/photos/preparation-room'; target.mkdir(parents=True,exist_ok=True)
def extract(second):
    path=target/f'frame-{second:03}s.jpg'
    if not path.exists():
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(second),'-i',str(source),'-frames:v','1','-vf','scale=-2:1280','-q:v','3','-y',str(path)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    return {'file':path.relative_to(root).as_posix(),'second':second,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
with ThreadPoolExecutor(max_workers=3) as pool: entries=list(pool.map(extract,sorted(seconds)))
out=root/'references/preparation-room-20261111'; out.mkdir(parents=True,exist_ok=True)
(out/'app-photo-manifest.json').write_text(json.dumps({'source':source.relative_to(root).as_posix(),'frames':entries},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(entries)} application frames, {sum(x["bytes"] for x in entries):,} bytes')
