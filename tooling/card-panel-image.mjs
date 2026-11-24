import { execFile } from 'node:child_process';

// Older bookmarks address a single JPEG. Crop that view from the retained
// 1600 × 500 card without requiring four extra image files per machine.
const cropScript = `import io, sys
from PIL import Image
with Image.open(io.BytesIO(sys.stdin.buffer.read())) as card:
    width, height = card.size
    side = int(sys.argv[1])
    panel = card.crop((side * width // 4, 0, (side + 1) * width // 4, height))
    panel.convert("RGB").save(sys.stdout.buffer, "JPEG", quality=95, subsampling=0)`;

export function renderCardPanel(bytes, face) {
  const index = ['front', 'left', 'right', 'rear'].indexOf(face);
  if (index < 0) throw new Error('Unknown card face.');
  return new Promise(resolve => {
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const child = execFile(python, ['-c', cropScript, String(index)], {
      encoding: 'buffer', windowsHide: true, timeout: 8000, maxBuffer: 2 * 1024 * 1024,
    }, (error, jpeg) => {
      if (!error && jpeg.length > 3 && jpeg.readUInt16BE(0) === 0xffd8) {
        resolve({ body: jpeg, type: 'image/jpeg' });
      } else {
        // The modeling viewer also works on machines without the drawing tools.
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="${index * 400} 0 400 500"><image width="1600" height="500" href="data:image/jpeg;base64,${bytes.toString('base64')}"/></svg>`;
        resolve({ body: Buffer.from(svg), type: 'image/svg+xml' });
      }
    });
    child.stdin.on('error', () => {}); // A missing interpreter closes stdin before its callback runs.
    child.stdin.end(bytes);
  });
}
