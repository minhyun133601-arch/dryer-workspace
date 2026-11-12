"""Preserve capture metadata and phone-location evidence, never survey walls."""
from pathlib import Path
import json, hashlib, subprocess, statistics
ROOT=Path(__file__).resolve().parents[2]
folder=ROOT/'references/guardhouse-team2-20261112/source'
video=next(folder.glob('*.mp4')); gps=next(folder.glob('*.txt'))
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]))
observations=[]
for line in gps.read_text(encoding='utf-8-sig').splitlines():
    if line.startswith('{') and 'video_time_ms' in line:
        try: value=json.loads(line)
        except ValueError: continue
        if isinstance(value.get('video_time_ms'),(float,int)): observations.append(value)
valid=[v for v in observations if v.get('geolocation',{}).get('status')=='valid']
samples=[]
for seconds in range(0,289,10):
    if not observations: break
    v=min(observations,key=lambda item:abs(item['video_time_ms']-seconds*1000)); p=v.get('geolocation',{}); d=v.get('camera_direction',{})
    samples.append({'seconds':v['video_time_ms']/1000,'status':p.get('status'),'latitude':p.get('latitude_degrees'),'longitude':p.get('longitude_degrees'),'accuracyMetres':p.get('horizontal_accuracy_m'),'headingDegrees':d.get('heading_degrees'),'pitchDegrees':d.get('pitch_degrees')})
manifest={'captureId':'FV-d9287b2a-f166-4cf6-b57f-80daac0b2175','captureStartKST':'2026-11-12 14:21:09','durationSeconds':float(probe['format']['duration']),'audioRecorded':False,'displayRotationDegrees':-90,'nativePixels':[1920,1080],'uprightPixels':[1080,1920],'files':[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest()} for p in [video,gps]],'gps':{'records':len(observations),'validRecords':len(valid),'samplesEvery10Seconds':samples,'usage':'WGS84 phone position and estimated video-time link; use continuous visual order for facade registration. Ignore altitude for building height.'},'probe':probe,'reviewFolders':['workspace/entrance-route-20261112/review-first','workspace/entrance-route-20261112/review-second']}
(folder.parent/'source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'duration':manifest['durationSeconds'],'gpsRecords':len(observations),'valid':len(valid),'sourceFiles':len(manifest['files'])}))
