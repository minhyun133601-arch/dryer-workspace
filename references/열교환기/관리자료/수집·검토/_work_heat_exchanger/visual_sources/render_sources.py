import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from evidence_paths import EVIDENCE_ROOT, load_source_json
import win32com.client
import fitz

ROOT=EVIDENCE_ROOT
WORK=Path(__file__).resolve().parents[1]
OUT=WORK/'visual_sources'
OUT.mkdir(exist_ok=True)
scope=load_source_json(WORK/'scope_audit.json')
ppt=Path(scope['processFacts'][0]['sourceFile'])
app=win32com.client.Dispatch('PowerPoint.Application')
presentation=None
try:
    presentation=app.Presentations.Open(str(ppt), -1, 0, 0)
    for i in (2,3):
        presentation.Slides(i).Export(str(OUT/f'install-slide-{i}.png'),'PNG',2560,1440)
    print('PowerPoint slides exported read-only')
finally:
    if presentation is not None:
        presentation.Close()

sources=[]
for raw in scope['visualEvidence']:
    source=Path(raw.get('sourceFile',''))
    if source.suffix.lower()=='.pdf' and source.is_file():
        sources.append(source)
# Stable source mapping from previous audit.
mapping=load_source_json(WORK/'render_mapping.json')
for i,m in enumerate(mapping):
    if len(fitz.open(m['source']))==1:
        source=Path(m['source'])
        doc=fitz.open(source)
        name='elevation' if i==0 else 'plan'
        doc[0].get_pixmap(matrix=fitz.Matrix(2.2,2.2)).save(OUT/f'{name}-full.png')
        doc.close()
print('PDF drawing renders exported')
