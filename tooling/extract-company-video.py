"""Re-extract the retained visual references; no position or scale is inferred."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / 'references/희창유업 홍보영상'
index = json.loads((FOLDER / 'reference-index.json').read_text(encoding='utf-8'))
video = FOLDER / index['video_file']
for shot in index['shots']:
    output = FOLDER / shot['file']
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(shot['seconds']), '-i', str(video), '-frames:v', '1', '-q:v', '2', '-y', str(output)], check=True)
print(f"Extracted {len(index['shots'])} visual reference frames.")
