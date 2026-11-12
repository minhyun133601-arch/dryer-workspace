from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
video = next(root.glob('20261109_133757*.mp4'))
target = root / 'apps/site/photos/outdoor-video'
target.mkdir(parents=True, exist_ok=True)
seconds = [0, 12, 18, 28, 42, 60, 84, 114, 120, 132, 156, 192, 216, 222, 234, 246, 252, 258, 264, 270]
for second in seconds:
    output = target / f'20261109_133757-{second:03d}s.jpg'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(second), '-i', str(video), '-frames:v', '1', '-vf', 'scale=-2:1400', '-q:v', '3', '-y', str(output)], check=True)
print(f'Extracted {len(seconds)} exact-time evidence frames.')
