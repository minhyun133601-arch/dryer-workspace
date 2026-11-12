"""Decode original animation frames and make offline reference contact sheets."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
import csv
import io
import json
import subprocess
from urllib.request import urlopen
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = 'C:/Windows/Fonts/malgun.ttf'


def frame(video, seconds, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    '-ss', str(seconds), '-i', str(video), '-frames:v', '1',
                    '-threads', '1', str(dest)], check=True)


def scene_frames(scene):
    slug = scene['id']
    video = ROOT / scene['video']
    frame(video, 6, ROOT / 'images' / (slug + '.png'))
    samples = [0, 1, 2, 3, 6, 8.7]
    board = Image.new('RGB', (1440, 892), '#141b24')
    draw = ImageDraw.Draw(board)
    draw.text((18, 12), scene['label'] + ' · 원본 영상 프레임', font=ImageFont.truetype(FONT, 25), fill='white')
    for index, seconds in enumerate(samples):
        dest = ROOT / 'images' / 'sequence' / f'{slug}-{seconds:g}s.png'
        frame(video, seconds, dest)
        with Image.open(dest) as im:
            thumb = im.convert('RGB').resize((480, 270), Image.Resampling.LANCZOS)
            x, y = index % 3 * 480, 52 + index // 3 * 408
            board.paste(thumb, (x, y))
            draw.text((x + 16, y + 284), f'{seconds:g}초', font=ImageFont.truetype(FONT, 22), fill='#d9e6f2')
    board.save(ROOT / 'images' / (slug + '-sequence.jpg'), quality=92)
    return slug


def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    with ThreadPoolExecutor(max_workers=3) as pool:
        print('Decoded:', ', '.join(pool.map(scene_frames, manifest['scenes'])))
    board = Image.new('RGB', (1920, 1270), '#101720')
    draw = ImageDraw.Draw(board)
    draw.text((22, 14), 'OWP 건조기 · 2팀 층별 원본 영상 이미지', font=ImageFont.truetype(FONT, 32), fill='white')
    for index, scene in enumerate(manifest['scenes']):
        x, y = index % 3 * 640, 76 + index // 3 * 592
        with Image.open(ROOT / 'images' / (scene['id'] + '.png')) as im:
            board.paste(im.convert('RGB').resize((640, 360), Image.Resampling.LANCZOS), (x, y))
        draw.text((x + 18, y + 378), scene['label'], font=ImageFont.truetype(FONT, 28), fill='white')
        draw.text((x + 18, y + 425), '1920×1080 / 영상 6초 시점', font=ImageFont.truetype(FONT, 21), fill='#a6b7c9')
    board.save(ROOT / 'images' / 'all-scenes.jpg', quality=93)
    data_dir = ROOT / 'data'
    data_dir.mkdir(exist_ok=True)
    endpoint = 'http://192.168.2.113:8080/OWP_HEECHANG/restService/selectC101000Monitering_MACHBASE?jsondata=%7B%7D'
    with urlopen(endpoint, timeout=20) as response:
        payload = json.load(response)
    data = payload['resultData']
    snapshot = {'source_url': endpoint, 'saved_at': datetime.now(timezone(timedelta(hours=9))).isoformat(),
                'note': 'Read-only response; snapshot values only, not a live connection.', 'resultData': data}
    (data_dir / 'monitoring-snapshot.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding='utf-8')
    with (data_dir / 'monitoring-snapshot.csv').open('w', encoding='utf-8-sig', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=['TID_NM', 'TID', 'SENSORNM', 'VALUE', 'USL1', 'LSL1', 'TIMESTAMP', 'SID'])
        writer.writeheader()
        writer.writerows(data)
    print('Snapshot rows:', len(data))


if __name__ == '__main__':
    main()
