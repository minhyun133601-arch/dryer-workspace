"""Read-only, timestamped review of the supplied third-floor packaging video."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import argparse
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--step', type=int, default=5)
parser.add_argument('--start', type=int, default=0)
parser.add_argument('--end', type=int)
parser.add_argument('--dense', action='store_true')
parser.add_argument('--output-name')
options = parser.parse_args()
if options.step < 1 or options.start < 0:
    parser.error('step must be positive and start nonnegative')
source = next((ROOT / '좌표').glob('*144753*.mp4'))
base = ROOT / 'workspace/stick-packaging-3f-20261109/video-review'
out = base.parent / 'dense-review' if options.dense else base
if options.output_name:
    if Path(options.output_name).name != options.output_name or options.output_name in ('.', '..'):
        parser.error('output-name must be a single folder name')
    out = base.parent / options.output_name
out.mkdir(parents=True, exist_ok=True)
frames = base / 'frames'
frames.mkdir(parents=True, exist_ok=True)
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(source)]))
duration = float(probe['format']['duration'])
times = list(range(options.start, min(int(duration), options.end or int(duration)), options.step))

def extract(t):
    target = frames / f'frame-{t:04d}s.jpg'
    if not target.exists():
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(t), '-i', str(source), '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', '-threads', '1', '-y', str(target)], check=True)
    return target

with ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(extract, times))

try:
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 17)
except OSError:
    font = ImageFont.load_default()
per_sheet, tile_height, image_height = (16, 324, 296) if options.dense else (20, 216, 188)
for start in range(0, len(times), per_sheet):
    group = times[start:start+per_sheet]
    sheet = Image.new('RGB', (1280, tile_height*(per_sheet//4)), '#e8ede8')
    draw = ImageDraw.Draw(sheet)
    for index, t in enumerate(group):
        x, y = index % 4 * 320, index // 4 * tile_height
        with Image.open(frames / f'frame-{t:04d}s.jpg') as raw:
            im = raw.copy()
        im.thumbnail((316, image_height))
        sheet.paste(im, (x+(320-im.width)//2, y))
        draw.text((x+8, y+image_height+2), f'{t//60:02d}:{t%60:02d} / {t}s', fill='#17372b', font=font)
    sheet.save(out / f'contact-{group[0]:04d}-{group[-1]:04d}s.jpg', quality=90)

(out / 'index.json').write_text(json.dumps({'source': str(source.relative_to(ROOT)), 'duration_seconds': duration, 'step_seconds': options.step, 'samples': [{'seconds': t, 'file': str((frames / f'frame-{t:04d}s.jpg').relative_to(ROOT))} for t in times], 'probe': probe, 'method': f'ffmpeg accurate input seek, sampled every {options.step} seconds; review thumbnails only; original untouched'}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'duration': duration, 'samples': len(times), 'contact_sheets': (len(times)+per_sheet-1)//per_sheet, 'folder': str(out)}, ensure_ascii=False))
