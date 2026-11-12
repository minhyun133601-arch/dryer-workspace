from pathlib import Path
import fitz, json, subprocess, concurrent.futures, re
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'_work'
TESS=r'C:\Program Files\Tesseract-OCR\tesseract.exe'
outdir=WORK/'late_ocr';outdir.mkdir(exist_ok=True)
dirs=sorted(p for p in (ROOT/'보고서별 폴더').iterdir() if p.is_dir() and '2026-06'<=p.name[:7]<='2026-11')
jobs=[]; result=[]
for di,d in enumerate(dirs):
 rec={'folder':str(d.relative_to(ROOT)),'files':[]};result.append(rec)
 for fi,p in enumerate(sorted(d.rglob('*'))):
  if p.suffix.lower()!='.pdf':continue
  doc=fitz.open(p); f={'path':str(p.relative_to(ROOT)),'pages':[]};rec['files'].append(f)
  if any(s in p.name for s in ['보험','증권','이행증권','보증']): continue
  for pi,page in enumerate(doc):
   text=page.get_text().strip();pg={'page':pi+1,'text':text,'ocr':False};f['pages'].append(pg)
   if len(re.sub(r'\s','',text))<100:
    img=outdir/f'{di}_{fi}_{pi}.png';page.get_pixmap(matrix=fitz.Matrix(2,2)).save(img);jobs.append((img,pg))
def run(job):
 img,pg=job;base=str(img.with_suffix(''))
 subprocess.run([TESS,str(img),base,'-l','kor+eng','--psm','3'],capture_output=True)
 pg['text']=Path(base+'.txt').read_text(encoding='utf8');pg['ocr']=True
 return str(img)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 for i,done in enumerate(ex.map(run,jobs)):print(i+1,len(jobs),done,flush=True)
(WORK/'reports_late_ocr.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
(WORK/'reports_late_ocr.txt').write_text('\n\n'.join('\n# '+r['folder']+'\n'+'\n'.join('\n## '+f['path']+'\n'+'\n'.join('Page '+str(p['page'])+'\n'+p['text'] for p in f['pages']) for f in r['files']) for r in result),encoding='utf8')
