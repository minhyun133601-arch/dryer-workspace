"""Archive public OWP animation resources; never sends plant control commands."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
import json
import re
import subprocess
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
BASE = 'http://192.168.2.113'
SCENES = [
    ('team2', '2팀 전체', '1', 'heechang_0529.webm'),
    ('floor1', '2팀 1층', '2', 'heechang_0425_1F.webm'),
    ('floor3', '2팀 3층', '3', 'heechang_0428_3FCloseup.webm'),
    ('floor4', '2팀 4층', '34', 'heechang_0428_3F4F.webm'),
    ('floor5-7', '2팀 5~7층', '57', 'heechang_0428_5F7F.webm'),
]


def download(path):
    output = ROOT / 'originals' / path.lstrip('/')
    output.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(BASE + path, timeout=30) as response:
        data = response.read()
        content_type = response.headers.get('Content-Type', '')
    if content_type.startswith('text/html'):
        raise RuntimeError('Unexpected HTML for resource: ' + path)
    output.write_bytes(data)
    return {'url': BASE + path, 'file': output.relative_to(ROOT).as_posix(),
            'bytes': len(data), 'sha256': sha256(data).hexdigest(),
            'content_type': content_type}


def main():
    web = ROOT / 'originals' / 'web'
    script = (web / '29.ec8c9355.chunk.js').read_text(encoding='utf-8')
    css = (web / '29.8d4f15ec.chunk.css').read_text(encoding='utf-8')
    paths = set(re.findall(r'url\([\'"]?(/assets/[^)\'\"]+)', css))
    paths.update(re.findall(r'"(/assets/models/[^"\s]+)"', script))
    resources, unavailable = [], []
    with ThreadPoolExecutor(max_workers=6) as pool:
        tasks = [(path, pool.submit(download, path)) for path in sorted(paths)]
        for path, task in tasks:
            try:
                resources.append(task.result())
            except Exception as error:
                unavailable.append({'url': BASE + path, 'reason': str(error)})
    scene_data = []
    for slug, label, radio, filename in SCENES:
        video = ROOT / 'originals' / 'assets' / 'models' / filename
        info = json.loads(subprocess.check_output(
            ['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(video)],
            encoding='utf-8'))
        stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
        scene_data.append({'id': slug, 'label': label, 'radio_value': radio,
                           'video': video.relative_to(ROOT).as_posix(),
                           'width': stream['width'], 'height': stream['height'],
                           'duration_seconds': float(info['format']['duration']),
                           'codec': stream['codec_name'], 'stable_frame_seconds': 6})
    manifest = {'source_page': BASE + '/pages/C101000',
                'archived_at': datetime.now(timezone(timedelta(hours=9))).isoformat(),
                'animation_format': 'WebM; no SWF referenced by monitoring scene',
                'scenes': scene_data, 'resources': resources, 'unavailable': unavailable,
                'image_note': 'PNG exports are frames decoded from original WebM, not logged-in live UI screenshots.'}
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'resources': len(resources), 'bytes': sum(r['bytes'] for r in resources),
                      'scenes': scene_data, 'unavailable': unavailable}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
