import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SURVEY_ORIGIN, SURVEY_PHOTOS, SURVEY_STATIONS, gpsToLocal,
} from '../apps/site/outdoor-survey.js';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';

const observationKey = ({ time, lat, lon, heading, pitch, accuracy }) =>
  JSON.stringify([time, lat, lon, heading, pitch, accuracy]);

test('all 128 camera observations match the retained capture filenames and any remaining original GPS files', async () => {
  // Capture filenames encode the source GPS fields independently of the app.
  // Keep only those small strings, rather than requiring archived source media.
  const filenames = JSON.parse(await readFile(new URL('./fixtures/evidence/outdoor-survey.json', import.meta.url), 'utf8'));
  const retainedOriginals = (await readdir(new URL('../실외기실/', import.meta.url)).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  }))
    .filter((filename) => /\.jpg$/i.test(filename));
  assert.equal(filenames.length, 128);
  assert.equal(SURVEY_PHOTOS.length, filenames.length);
  const sourceFiles = new Set(filenames);
  assert.equal(sourceFiles.size, filenames.length);
  assert.ok(retainedOriginals.length <= filenames.length);
  for (const filename of retainedOriginals) assert.ok(sourceFiles.has(filename), `retained original has no source metadata: ${filename}`);
  const filenamePattern = /^20261030_(\d{6})KST_GPS-VALID_LAT(-?[\d.]+)_LON(-?[\d.]+)_H([\d.]+)-TN_DIR-AVAILABLE_P(-?[\d.]+)_ACC([\d.]+)m_.+\.jpg$/;
  const originalObservations = filenames.map((filename) => {
    const match = filename.match(filenamePattern);
    assert.ok(match, `unexpected original metadata: ${filename}`);
    const [, time, lat, lon, heading, pitch, accuracy] = match;
    const observation = { time, lat: Number(lat), lon: Number(lon), heading: Number(heading), pitch: Number(pitch), accuracy: Number(accuracy) };
    return observation;
  });
  assert.deepEqual(SURVEY_PHOTOS.map(observationKey), originalObservations.map(observationKey));
  assert.equal(new Set(SURVEY_PHOTOS.map((photo) => photo.id)).size, filenames.length);
  assert.deepEqual(SURVEY_PHOTOS.map((photo) => photo.index), Array.from({ length: filenames.length }, (_, index) => index));

  for (const photo of SURVEY_PHOTOS) {
    assert.equal(photo.position[1], 0, 'an unmeasured altitude must not be fabricated');
    assert.ok(photo.position.every(Number.isFinite), photo.id);
    assert.ok(photo.heading >= 0 && photo.heading < 360, photo.id);
    assert.ok(photo.accuracy > 0, photo.id);
  }
});

test('the local map has an exact origin, east-positive X and north-negative Z in metre scale', () => {
  assert.ok(gpsToLocal(SURVEY_ORIGIN.lat, SURVEY_ORIGIN.lon).every((value) => value === 0));
  const east = gpsToLocal(SURVEY_ORIGIN.lat, SURVEY_ORIGIN.lon + .0001);
  const west = gpsToLocal(SURVEY_ORIGIN.lat, SURVEY_ORIGIN.lon - .0001);
  const north = gpsToLocal(SURVEY_ORIGIN.lat + .0001, SURVEY_ORIGIN.lon);
  const south = gpsToLocal(SURVEY_ORIGIN.lat - .0001, SURVEY_ORIGIN.lon);
  assert.ok(east[0] > 9 && east[0] < 9.2);
  assert.ok(east[2] === 0);
  assert.equal(west[0], -east[0]);
  assert.ok(north[2] < -11 && north[2] > -11.2);
  assert.equal(north[0], 0);
  assert.equal(south[2], -north[2]);
});

test('retired camera image paths preserve all shooting stations without becoming runtime photo requests', async () => {
  const siteRoot = await realpath(fileURLToPath(new URL('../apps/site/', import.meta.url)));
  const imagePaths = new Set();
  for (const photo of SURVEY_PHOTOS) {
    assert.match(photo.photo, new RegExp(`^\\./photos/outdoor/20261030_${photo.time}-${String(photo.index).padStart(3, '0')}\\.jpg$`));
    const imagePath = path.resolve(siteRoot, photo.photo);
    assert.equal(isRetainedEvidenceImage(photo.photo), false, 'ordinary survey photographs are staged outside the app');
    const relative = path.relative(siteRoot, imagePath);
    assert.ok(relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), photo.photo);
    imagePaths.add(imagePath);
  }
  assert.equal(imagePaths.size, SURVEY_PHOTOS.length);
  const coveredIndexes = SURVEY_STATIONS.flatMap((station) => station.photoIndexes);
  assert.deepEqual(coveredIndexes.toSorted((a, b) => a - b), SURVEY_PHOTOS.map((photo) => photo.index));
  assert.equal(new Set(coveredIndexes).size, SURVEY_PHOTOS.length);
  for (const station of SURVEY_STATIONS) {
    assert.ok(station.photoIndexes.includes(station.index));
    assert.deepEqual(station.position, SURVEY_PHOTOS[station.index].position);
  }
});
