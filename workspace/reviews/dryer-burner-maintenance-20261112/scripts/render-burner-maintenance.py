from pathlib import Path
import hashlib
import json
import struct
import win32com.client

ROOT = Path(__file__).resolve().parents[4]
BUNDLE = ROOT / 'references/dryer-burner-maintenance-20261112'
source_info = json.loads((BUNDLE / 'source-info.json').read_text(encoding='utf-8-sig'))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def shape_texts(shapes):
    texts = []
    for shape in shapes:
        if shape.Type == 6:
            texts.extend(shape_texts(shape.GroupItems))
        if shape.HasTextFrame and shape.TextFrame.HasText:
            texts.append(shape.TextFrame.TextRange.Text.replace('\r', '\n'))
        if shape.HasTable:
            table = shape.Table
            for row in range(1, table.Rows.Count + 1):
                texts.append(' | '.join(table.Cell(row, col).Shape.TextFrame.TextRange.Text.replace('\r', '\n') for col in range(1, table.Columns.Count + 1)))
    return texts


app = win32com.client.DispatchEx('PowerPoint.Application')
app.AutomationSecurity = 3
decks = []
try:
    for entry in source_info:
        source = ROOT / entry['currentPath']
        if sha256(source) != entry['sha256']:
            raise RuntimeError('Source hash changed before rendering: ' + str(source))
        output = ROOT / 'apps/site/assets/documents/dryer-burner' / entry['id']
        output.mkdir(parents=True, exist_ok=True)
        presentation = app.Presentations.Open(str(source), True, False, False)
        try:
            width_pt = float(presentation.PageSetup.SlideWidth)
            height_pt = float(presentation.PageSetup.SlideHeight)
            width_px = 1920
            height_px = round(width_px * height_pt / width_pt)
            slides = []
            for slide in presentation.Slides:
                target = output / f'slide-{slide.SlideIndex:03d}.jpg'
                slide.Export(str(target), 'JPG', width_px, height_px)
                texts = shape_texts(slide.Shapes)
                notes = shape_texts(slide.NotesPage.Shapes)
                slides.append({
                    'number': int(slide.SlideIndex),
                    'slideId': int(slide.SlideID),
                    'hiddenInSlideShow': bool(slide.SlideShowTransition.Hidden),
                    'imagePath': target.relative_to(ROOT).as_posix(),
                    'width': width_px,
                    'height': height_px,
                    'bytes': target.stat().st_size,
                    'sha256': sha256(target),
                    'shapeCount': int(slide.Shapes.Count),
                    'text': texts,
                    'notes': notes,
                })
            deck = dict(entry)
            deck.update({
                'pageCount': int(presentation.Slides.Count),
                'widthPt': width_pt,
                'heightPt': height_pt,
                'slides': slides,
            })
            decks.append(deck)
            print(entry['id'] + ': ' + str(len(slides)) + ' slides', flush=True)
        finally:
            presentation.Close()
        if sha256(source) != entry['sha256']:
            raise RuntimeError('Source hash changed during rendering: ' + str(source))
finally:
    app.Quit()

manifest = {
    'version': 1,
    'date': '2026-11-12',
    'renderer': 'Microsoft PowerPoint 16.0 COM Slide.Export (JPG)',
    'renderPolicy': 'Read-only open. Export every slide in original order, including hidden slides, at native aspect ratio and 1920px width. Source files are not rewritten.',
    'decks': decks,
}
(BUNDLE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
text_lines = []
for deck in decks:
    text_lines.extend([deck['originalName'], '=' * 64])
    for slide in deck['slides']:
        text_lines.extend(['', f"Slide {slide['number']}", *slide['text']])
(BUNDLE / 'slide-text.txt').write_text('\n'.join(text_lines) + '\n', encoding='utf-8')
