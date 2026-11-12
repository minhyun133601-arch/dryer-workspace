"""Export Office print layouts through one isolated application per batch.

Inputs are copied into a TemporaryDirectory. Normal mode writes only separate
office-batch output; --update-cache explicitly upgrades existing incomplete
Office previews. No user Office process is attached to or terminated.
"""
from __future__ import annotations
import argparse
import csv
import json
import hashlib
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

from build_previews import atomic_json, cleanup_owned_office, original_path, render_pdf

APP=Path(__file__).resolve().parent
ROOT=APP.parent/'건물3D 후보도면'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit',type=int,default=3)
    parser.add_argument('--format',choices=['excel','word','powerpoint'],default='excel')
    parser.add_argument('--update-cache',action='store_true')
    parser.add_argument('--batch-timeout',type=int,default=1800)
    args=parser.parse_args()
    formats={'excel':{'.xls','.xlsx'},'word':{'.doc','.docx'},'powerpoint':{'.ppt','.pptx'}}
    with (ROOT/'00_도면목록.csv').open(encoding='utf-8-sig',newline='') as fp:
        rows=[r for r in csv.DictReader(fp) if r['확장자'].lower() in formats[args.format]]
    selected=[]
    for row in rows:
        meta_path=APP/'cache'/row['SHA256']/'meta.json'
        old=json.loads(meta_path.read_text(encoding='utf-8')) if meta_path.exists() else {}
        if old.get('previewQuality')=='detailed' and old.get('status')=='ready':
            continue
        selected.append(row)
    selected.sort(key=lambda r: json.loads((APP/'cache'/r['SHA256']/'meta.json').read_text(encoding='utf-8')).get('status')=='ready' if (APP/'cache'/r['SHA256']/'meta.json').exists() else False)
    if args.limit>0:selected=selected[:args.limit]
    records=[]
    out=APP/'office-batch' if args.format=='excel' else APP/'office-batch'/args.format
    out.mkdir(parents=True,exist_ok=True)
    started=time.monotonic()
    with tempfile.TemporaryDirectory(prefix='heechang-office-batch-') as temporary:
        job=Path(temporary)
        items=[]
        for row in selected:
            copied=row['SHA256']+row['확장자'].lower()
            source=original_path(ROOT,row)
            if hashlib.sha256(source.read_bytes()).hexdigest()!=row['SHA256']:
                raise RuntimeError('Source SHA does not match original manifest: '+row['원본파일명'])
            shutil.copyfile(source,job/copied)
            items.append({'id':row['SHA256'],'sourceName':copied})
        atomic_json(job/'job.json',{'format':args.format,'items':items})
        command=['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(APP/'tools'/'convert-office-batch.ps1'),'-JobPath',str(job)]
        with (out/'batch-output.log').open('w',encoding='utf-8') as log:
            process=subprocess.Popen(command,stdin=subprocess.DEVNULL,stdout=log,stderr=log,
                                     creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            seen=set()
            try:
                while True:
                    for row in selected:
                        sha=row['SHA256']
                        result_path=job/(sha+'.json')
                        if sha in seen or not result_path.exists():continue
                        try:result=json.loads(result_path.read_text(encoding='utf-8-sig'))
                        except (OSError,ValueError):continue
                        seen.add(sha)
                        result['name']=row['원본파일명']
                        if result.get('ok'):
                            try:
                                dest=out/sha
                                dest.mkdir(parents=True,exist_ok=True)
                                pages=render_pdf(job/(sha+'.pdf'),dest)
                                result['pages']=len(pages)
                                result['images']=[{'filename':p['src'].rsplit('/',1)[-1],'width':p['width'],'height':p['height']} for p in pages]
                                if args.update_cache:
                                    cache_dir=APP/'cache'/sha
                                    cache_dir.mkdir(parents=True,exist_ok=True)
                                    for page in pages:
                                        filename=page['src'].rsplit('/',1)[-1]
                                        shutil.copyfile(dest/filename,cache_dir/filename)
                                    app_name={'excel':'Excel','word':'Word','powerpoint':'PowerPoint'}[args.format]
                                    atomic_json(cache_dir/'meta.json',{'id':sha,'kind':'office','status':'ready','previewQuality':'detailed',
                                        'pages':pages,'warnings':[f'원본의 복사본을 전용 {app_name} 세션에서 읽기 전용으로 열고 저장된 인쇄 설정에 따라 전체 페이지를 변환했습니다.'],
                                        'updated':time.time()})
                            except Exception as exc:result['ok']=False;result['error']=str(exc)
                        records.append(result)
                        atomic_json(out/'summary.json',{'total':len(selected),'processed':len(records),'elapsed':time.monotonic()-started,'items':records})
                        print(json.dumps({k:v for k,v in result.items() if k!='images'},ensure_ascii=True),flush=True)
                    code=process.poll()
                    if code is not None and len(seen)==len(selected):break
                    if code is not None:
                        raise RuntimeError('Batch process exited before all jobs: '+(job/'fatal.json').read_text(encoding='utf-8') if (job/'fatal.json').exists() else 'Batch process exited early')
                    if time.monotonic()-started>args.batch_timeout:
                        cleanup_owned_office(job)
                        process.terminate();process.wait(timeout=10)
                        raise RuntimeError('Office batch timed out; completed jobs remain recorded')
                    time.sleep(.5)
            finally:
                if process.poll() is None:
                    cleanup_owned_office(job)
                    process.terminate();process.wait(timeout=10)
    print(json.dumps({'processed':len(records),'total':len(selected),'ok':sum(bool(r.get('ok')) for r in records),'seconds':round(time.monotonic()-started,2)}),flush=True)


if __name__=='__main__':main()
