"""Build browser evidence and GPS observations from the preserved source manifest."""
import json
import math
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SURVEY = ROOT / 'workspace' / 'outdoor-survey'
SOURCE = ROOT / '실외기실'
OUTPUT = ROOT / 'apps' / 'site' / 'photos' / 'outdoor'
ORIGIN = {'lat': 35.362, 'lon': 129.031}
OUTPUT.mkdir(parents=True, exist_ok=True)
records = json.loads((SURVEY / 'metadata.json').read_text(encoding='utf-8'))


def optimize(record):
    name = f"20261030_{record['time']}-{record['index']:03d}.jpg"
    source = SOURCE / record['file']
    target = OUTPUT / name
    if source.is_file():
        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original).convert('RGB')
            image.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
            image.save(target, quality=80, optimize=True, progressive=True)
    elif target.is_file():
        # Full-resolution source media may be removed after the complete
        # browser gallery and filename/GPS manifest have been preserved.
        with Image.open(target) as retained:
            retained.verify()
    else:
        raise FileNotFoundError(f"Missing original and browser evidence: {source} / {target}")
    return {
        'id': f"outdoor-photo-{record['index']:03d}",
        **{key: record[key] for key in ('index', 'time', 'lat', 'lon', 'heading', 'pitch', 'accuracy')},
        'photo': f'./photos/outdoor/{name}',
    }


with ThreadPoolExecutor(max_workers=6) as pool:
    photos = list(pool.map(optimize, records))

module = '''// 2026-10-30 KST camera observations preserved in metadata.json from 128 source filenames.
// H is true-north camera heading in degrees; it is not elevation or altitude.
// GPS marks the camera, not the photographed equipment. Subject range is unknown.
// No observed elevation exists here: local Y=0 is only the reconstruction datum.
export const SURVEY_ORIGIN = Object.freeze({ lat: 35.362, lon: 129.031 });

// Local WGS84 tangent approximation for this small site: X east, Z south.
export function gpsToLocal(lat, lon) {
  const rad = Math.PI / 180;
  const phi = SURVEY_ORIGIN.lat * rad;
  const e2 = 6.69437999014e-3;
  const denominator = Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const primeVertical = 6378137 / denominator;
  const meridian = 6378137 * (1 - e2) / denominator ** 3;
  return [
    Math.round((lon - SURVEY_ORIGIN.lon) * rad * primeVertical * Math.cos(phi) * 1000) / 1000,
    0,
    Math.round(-(lat - SURVEY_ORIGIN.lat) * rad * meridian * 1000) / 1000,
  ];
}

const observations = __PHOTOS__;

export const SURVEY_PHOTOS = Object.freeze(observations.map((photo) => Object.freeze({
  ...photo, position: Object.freeze(gpsToLocal(photo.lat, photo.lon)),
})));

// Sequential station thinning prevents overlapping markers during bursts.
// Each station retains the indexes of the original observations it represents.
export const SURVEY_STATIONS = Object.freeze(SURVEY_PHOTOS.reduce((stations, photo) => {
  const previous = stations[stations.length - 1];
  if (!previous || Math.hypot(photo.position[0] - previous.position[0], photo.position[2] - previous.position[2]) >= 1.2) {
    stations.push({ ...photo, photoIndexes: [photo.index] });
  } else {
    previous.photoIndexes.push(photo.index);
  }
  return stations;
}, []).map((station) => Object.freeze({ ...station, photoIndexes: Object.freeze(station.photoIndexes) })));

export const SURVEY_STATS = Object.freeze({
  photoCount: SURVEY_PHOTOS.length,
  stationCount: SURVEY_STATIONS.length,
  accuracyMin: Math.min(...SURVEY_PHOTOS.map((photo) => photo.accuracy)),
  accuracyMax: Math.max(...SURVEY_PHOTOS.map((photo) => photo.accuracy)),
  extentEast: [Math.min(...SURVEY_PHOTOS.map((photo) => photo.position[0])), Math.max(...SURVEY_PHOTOS.map((photo) => photo.position[0]))],
  extentSouth: [Math.min(...SURVEY_PHOTOS.map((photo) => photo.position[2])), Math.max(...SURVEY_PHOTOS.map((photo) => photo.position[2]))],
});

export const SURVEY_NOTE = '좌표는 촬영한 휴대전화의 GPS 위치이며 설비의 측량점이 아닙니다. 촬영 방향은 진북 기준, 크기·설비 위치는 사진 비례에 따른 추정입니다. 고도 자료가 없어 지반 높낮이는 확정하지 않았습니다.';
'''
module = module.replace('__PHOTOS__', json.dumps(photos, ensure_ascii=False, separators=(',', ':')))
(ROOT / 'apps' / 'site' / 'outdoor-survey.js').write_text(module, encoding='utf-8')
print(json.dumps({'photos': len(photos), 'totalBytes': sum(path.stat().st_size for path in OUTPUT.glob('*.jpg')), 'module': 'apps/site/outdoor-survey.js'}))
