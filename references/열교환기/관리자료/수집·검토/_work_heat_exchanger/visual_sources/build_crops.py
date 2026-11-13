from pathlib import Path
from PIL import Image
import shutil, json

WORK=Path(__file__).resolve().parent
source=WORK/'install-slide-2.png'
im=Image.open(source)
box=(208,598,2298,1311)
im.crop(box).save(WORK/'installation-route.png')
# These are literal crops and duplicate pixels only; originals remain untouched.
shutil.copy2(WORK.parent/'image3.png',WORK/'pid-original.png')
shutil.copy2(WORK.parent/'image4.jpeg',WORK/'supply-fan-photo.jpeg')
pid=Image.open(WORK/'pid-original.png')
pid.crop((750,70,1070,360)).resize((960,870)).save(WORK/'pid-recovery-detail.png')
manifest={
  'slide2Dimensions':list(im.size),'installationRouteCropPx':list(box),
  'files':{p.name:{'width':Image.open(p).width,'height':Image.open(p).height,'bytes':p.stat().st_size} for p in WORK.glob('*') if p.suffix.lower() in ('.png','.jpeg')}
}
(WORK/'image_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False))
