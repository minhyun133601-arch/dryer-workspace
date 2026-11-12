import json, re, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
import win32com.client

root=Path(__file__).resolve().parent.parent
work=root/'_work'/'year_bridge'
candidate=work/'candidate.pptx'
native=work/'powerpoint_renders'
native.mkdir(exist_ok=True)
manifest=json.loads((work/'manifest.json').read_text(encoding='utf8'))
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
with zipfile.ZipFile(candidate) as z:
    slides=sorted([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)],key=lambda n:int(re.search(r'slide(\d+)',n).group(1)))
    assert len(slides)==16
    for n in manifest['nativeTables']:
        xml=ET.fromstring(z.read(f'ppt/slides/slide{n}.xml'))
        assert xml.find('.//a:tbl',ns) is not None,n
    for n in range(1,17):
        assert f'ppt/notesSlides/notesSlide{n}.xml' in z.namelist(),n
    texts=[''.join(ET.fromstring(z.read(s)).itertext()) for s in slides]
    assert '41.7' in texts[3]
    assert all(x in texts[2] for x in ['800','639','100','136','120','1,795'])
    assert sum(x['budget'] for x in manifest['sourceBudgets'])==1795

app=pres=None
out={'slides':len(slides),'native_table_slides':manifest['nativeTables'],'source_budget_total_million':manifest['total'],'text_overflows':[],'table_footer_overlaps':[]}
try:
    app=win32com.client.DispatchEx('PowerPoint.Application')
    pres=app.Presentations.Open(str(candidate),ReadOnly=True,Untitled=False,WithWindow=False)
    assert pres.Slides.Count==16
    pres.Export(str(native),'PNG',1600,900)
    for sn in range(1,17):
        sl=pres.Slides(sn)
        for sh in sl.Shapes:
            if sh.HasTable and sh.Top+sh.Height>480:
                out['table_footer_overlaps'].append({'slide':sn,'shape':sh.Name,'bottom_pt':sh.Top+sh.Height})
            if sh.HasTextFrame and sh.TextFrame.HasText:
                try:
                    actual=sh.TextFrame2.TextRange.BoundHeight
                    if actual>sh.Height+3:
                        out['text_overflows'].append({'slide':sn,'shape':sh.Name,'height':sh.Height,'bound_height':actual,'text':sh.TextFrame.TextRange.Text[:130]})
                except Exception:
                    pass
    out['powerpoint_version']=app.Version
finally:
    if pres is not None:pres.Close()
    if app is not None:app.Quit()
(work/'native_validation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(out,ensure_ascii=False,indent=2))
