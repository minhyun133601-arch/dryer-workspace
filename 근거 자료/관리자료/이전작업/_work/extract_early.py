from pathlib import Path
import os, json, re, subprocess, concurrent.futures, io
import fitz
from PIL import Image
from pptx import Presentation
import openpyxl
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'_work'; OUT.mkdir(exist_ok=True)
OCR=OUT/'early_ocr'; OCR.mkdir(exist_ok=True)
dirs=sorted(p for p in (ROOT/'보고서별 폴더').iterdir() if p.is_dir() and p.name[:7] in ['2026-01','2026-02','2026-03','2026-04','2026-05'])
def ocr_one(job):
    dest, img=job
    if dest.exists(): return dest.name
    env=os.environ.copy(); env['OMP_THREAD_LIMIT']='1'
    p=subprocess.run(['tesseract','stdin','stdout','--tessdata-dir',str(OUT/'tessdata'),'-l','kor+eng','--psm','6'], input=img, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    dest.write_text(p.stdout.decode('utf-8',errors='replace'),encoding='utf-8')
    return dest.name
jobs=[]; manifest=[]; native=[]
for i,d in enumerate(dirs,1):
    item={'index':i,'report':d.name,'files':[]}; manifest.append(item)
    im=Image.open(d/'보고서 본문.jpg').convert('RGB'); im=im.resize((im.width*3,im.height*3)); buf=io.BytesIO(); im.save(buf,format='PNG')
    dest=OCR/f'{i:02d}_body.txt'; jobs.append((dest,buf.getvalue())); item['files'].append({'file':'보고서 본문.jpg','ocr':dest.name})
    for j,f in enumerate(sorted((d/'첨부파일').glob('*')) if (d/'첨부파일').exists() else [],1):
        if f.suffix.lower()=='.pptx':
            p=Presentation(f); tx='\n\n'.join('slide '+str(k+1)+'\n'+'\n'.join(s.text if s.has_text_frame else '\n'.join(' | '.join(c.text for c in r.cells) for r in s.table.rows) if s.has_table else '' for s in sl.shapes) for k,sl in enumerate(p.slides))
            native.append({'report':d.name,'file':str(f.relative_to(ROOT)),'text':tx})
        elif f.suffix.lower()=='.xlsx':
            w=openpyxl.load_workbook(f,data_only=True); tx='\n\n'.join(s.title+'\n'+'\n'.join(' | '.join(str(c) if c is not None else '' for c in row) for row in s.values if any(c is not None for c in row)) for s in w)
            native.append({'report':d.name,'file':str(f.relative_to(ROOT)),'text':tx})
        elif f.suffix.lower()=='.pdf':
            doc=fitz.open(f)
            for k,page in enumerate(doc):
                tx=page.get_text()
                if len(tx)>150:
                    native.append({'report':d.name,'file':str(f.relative_to(ROOT)),'page':k+1,'text':tx}); continue
                # first two pages and all analytic/quote/scrap documents
                if k>1 and not any(v in f.name for v in ['분석','견적','계근','확인','기안','완료']): continue
                pix=page.get_pixmap(matrix=fitz.Matrix(2.1,2.1)); dest=OCR/f'{i:02d}_{j:02d}_p{k+1}.txt'; jobs.append((dest,pix.tobytes('png'))); item['files'].append({'file':str(f.relative_to(d)),'page':k+1,'ocr':dest.name})
(OUT/'early_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'early_native.json').write_text(json.dumps(native,ensure_ascii=False,indent=2),encoding='utf-8')
print('OCR jobs',len(jobs),'native items',len(native),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
    for n,v in enumerate(ex.map(ocr_one,jobs),1):
        if n%10==0: print(n,v,flush=True)
for item in manifest:
    tx=item['report']+'\n\n'+ '\n\n'.join(x['file']+' page '+str(x.get('page',''))+'\n'+(OCR/x['ocr']).read_text(encoding='utf-8') for x in item['files'])+'\n\n'+'\n\n'.join(x['file']+' page '+str(x.get('page',''))+'\n'+x['text'] for x in native if x['report']==item['report'])
    (OCR/f"{item['index']:02d}_combined.txt").write_text(tx,encoding='utf-8')
print('complete',flush=True)
