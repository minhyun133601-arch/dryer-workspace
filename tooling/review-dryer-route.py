"""Extract timestamped review frames from the retained 1F–mezzanine–3F walk."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--start', type=float, default=0)
parser.add_argument('--end', type=float, default=725)
parser.add_argument('--step', type=float, default=6)
parser.add_argument('--name', default='overview')
args = parser.parse_args()
if args.step <= 0 or args.start < 0 or Path(args.name).name != args.name:
    parser.error('Use a positive step, nonnegative start, and a simple review name')
source = next((ROOT / '1팀 2파트 출입구 - 1.5층 - 3층').glob('*.mp4'))
base = ROOT / 'workspace/dryer-entrance-mezzanine-20261112'
frames = base / 'frames'
out = base / args.name
frames.mkdir(parents=True, exist_ok=True)
out.mkdir(parents=True, exist_ok=True)
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(source)]))
duration = float(probe['format']['duration'])
times = []
t = args.start
while t < min(args.end, duration):
    times.append(round(t, 3))
    t += args.step

def frame_path(t):
    return frames / f'frame-{t:07.2f}s.jpg'

def extract(t):
    target = frame_path(t)
    if not target.exists():
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(t), '-i', str(source), '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3', '-threads', '1', '-y', str(target)], check=True)
    return target

with ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(extract, times))
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 18)
for start in range(0, len(times), 16):
    group = times[start:start + 16]
    sheet = Image.new('RGB', (1280, 2440), '#edf0eb')
    draw = ImageDraw.Draw(sheet)
    for i, second in enumerate(group):
        x, y = i % 4 * 320, i // 4 * 610
        with Image.open(frame_path(second)) as raw:
            im = raw.copy()
        im.thumbnail((316, 575))
        sheet.paste(im, (x + (320 - im.width) // 2, y))
        draw.text((x + 7, y + 580), f'{int(second)//60:02d}:{second%60:05.2f} / {second:g}s', fill='#17372b', font=font)
    sheet.save(out / f'contact-{group[0]:07.2f}-{group[-1]:07.2f}s.jpg', quality=91)
(out / 'index.json').write_text(json.dumps({
    'source': str(source.relative_to(ROOT)), 'duration_seconds': duration,
    'step_seconds': args.step, 'samples': [{'seconds': t, 'file': str(frame_path(t).relative_to(ROOT))} for t in times],
    'probe': probe, 'method': 'Timestamped visual review; auto-rotated video frames. Original untouched. GPS is camera metadata, never room geometry.',
    'drawing_policy': 'Photographed drawings are reference-only; current visible room sequence and explicit user corrections govern reconstruction.'
}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'duration': duration, 'samples': len(times), 'sheets': (len(times)+15)//16, 'folder': str(out)}, ensure_ascii=False))
