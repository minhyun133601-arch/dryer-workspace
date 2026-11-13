import json
from collections import Counter
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from evidence_paths import EVIDENCE_ROOT, APPROVALS, load_source_json
import fitz

ROOT=EVIDENCE_ROOT
WORK=Path(__file__).resolve().parent
records=load_source_json(APPROVALS)['documents']
record=next(x for x in records if x['docId']=='334757')
assets=WORK/'source_assets';assets.mkdir(parents=True,exist_ok=True)
summary=[]
for p in Path(record['attachmentDir']).glob('*.pdf'):
    doc=fitz.open(p)
    if len(doc)!=1:continue
    pg=doc[0]
    stem='front' if '정면' in p.name else 'plan'
    (assets/(stem+'.svg')).write_text(pg.get_svg_image(text_as_path=True),encoding='utf-8')
    pg.get_pixmap(matrix=fitz.Matrix(6,6),alpha=False).save(assets/(stem+'-6x.png'))
    drawings=pg.get_drawings()
    colors=Counter(str(x.get('color')) for x in drawings)
    summary.append({'id':stem,'sourceFile':str(p),'sourcePage':1,'pdfRect':list(pg.rect),'pdfVectorPaths':len(drawings),'embeddedRasterImages':len(pg.get_images()),'svg':str(assets/(stem+'.svg')),'render':str(assets/(stem+'-6x.png')),'renderScale':6,'colors':dict(colors)})
(WORK/'vector_source_manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
