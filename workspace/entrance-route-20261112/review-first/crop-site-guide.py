from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[3]
source=Path(__file__).resolve().parent/'native/frame-144s.jpg'
target=ROOT/'apps/site/assets/drawings/campus/entrance-site-guide-2026.jpg'
target.parent.mkdir(parents=True,exist_ok=True)
rect=(270,380,1030,1350)
Image.open(source).crop(rect).save(target,quality=95,subsampling=0)
(Path(__file__).resolve().parent/'site-guide-crop.json').write_text(json.dumps({'source':str(source.relative_to(ROOT)),'target':str(target.relative_to(ROOT)),'videoSeconds':144,'cropPixels':rect,'method':'rectangular document crop only; no perspective correction; all site-map labels retained'},ensure_ascii=False,indent=2),encoding='utf8')
print(target)
