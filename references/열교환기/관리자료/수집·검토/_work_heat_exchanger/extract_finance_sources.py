import json
from pathlib import Path
from evidence_paths import EVIDENCE_ROOT, load_source_json
import fitz
import openpyxl
import win32com.client
from pptx import Presentation

ROOT=EVIDENCE_ROOT
WORK=Path(__file__).resolve().parent
meta=load_source_json(WORK/'doc_source.json')
att=Path(meta['attachmentDir'])
results={}
for p in att.iterdir():
    if p.suffix.lower()=='.xlsx':
        wbf=openpyxl.load_workbook(p,data_only=False)
        wbv=openpyxl.load_workbook(p,data_only=True)
        results[p.name]={}
        for s in wbf:
            rows=[]
            for row in s:
                values=[]
                for c in row:
                    if c.value is not None:
                        values.append({'cell':c.coordinate,'value':str(c.value),'cached':str(wbv[s.title][c.coordinate].value),'number_format':c.number_format})
                if values: rows.extend(values)
            results[p.name][s.title]=rows
    elif p.suffix.lower()=='.pptx':
        prs=Presentation(p)
        results[p.name]=[]
        for i,slide in enumerate(prs.slides):
            text=[]
            for shape in slide.shapes:
                if shape.has_text_frame:text.append(shape.text)
                if shape.has_table:
                    text.extend('|'.join(c.text for c in row.cells) for row in shape.table.rows)
            results[p.name].append({'slide':i+1,'text':'\n'.join(text),'shapes':len(slide.shapes)})
    elif p.suffix.lower()=='.pdf':
        pdf=fitz.open(p)
        results[p.name]=[]
        for i,page in enumerate(pdf):
            results[p.name].append({'page':i+1,'text':page.get_text()})
            if '견적' in p.name:
                page.get_pixmap(matrix=fitz.Matrix(1.7,1.7)).save(WORK/f'quote-p{i+1}.png')
ex=win32com.client.DispatchEx('Excel.Application')
ex.Visible=False
ex.DisplayAlerts=False
ex.AskToUpdateLinks=False
book=None
try:
    p=next(p for p in att.iterdir() if p.suffix.lower()=='.xls')
    book=ex.Workbooks.Open(str(p),UpdateLinks=0,ReadOnly=True)
    result=[]
    for sh in book.Worksheets:
        used=sh.UsedRange
        formulas=used.Formula
        rows=[]
        for ri,row in enumerate(formulas):
            for ci,val in enumerate(row):
                if isinstance(val,str) and val.startswith('='):
                    rows.append({'cell':sh.Cells(used.Row+ri,used.Column+ci).Address,'formula':val,'value':sh.Cells(used.Row+ri,used.Column+ci).Value})
        result.append({'sheet':sh.Name,'usedRange':used.Address,'formulaCount':len(rows),'formulas':rows,'shapeCount':sh.Shapes.Count})
    results['xls_formula_audit']=result
finally:
    if book is not None:book.Close(False)
    ex.Quit()
(WORK/'attachment_extraction.json').write_text(json.dumps(results,ensure_ascii=False,indent=2,default=str),encoding='utf8')
for k,v in results.items():
    print('\nFILE',k)
    print(json.dumps(v,ensure_ascii=False,indent=2,default=str)[:20000])
