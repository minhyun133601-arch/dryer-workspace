import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { EQUIPMENT, FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight } from '../apps/site/building-data.js';
import { PLACEMENT_REGIONS } from '../apps/site/placement-rules.js';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';
import { readProjectText as read, namespaceModule as namespace, replaceRequired, bundleBurnerMaintenance } from './site-export-utils.mjs';

const root = new URL('../', import.meta.url);
const modelFields = ['id', 'floor', 'name', 'type', 'tag', 'position', 'rotation', 'previousRotation', 'previousPlacements', 'placementRevision', 'parts', 'labelHeight', 'height', 'length', 'radius', 'variant', 'visibleFloors', 'width', 'depth', 'belowFloor', 'stations', 'positionBasis', 'positionConfidence', 'preparation', 'dryerRoute'];
const sceneDependencies = new Set([
  '../shared/vendor/three.module.js', './furnace-model.js', './facility-data.js', './facility-models.js', './dryer-process-models.js',
  './preparation-models.js', './boiler-models.js', './preparation-environment.js', './dryer-upper-models.js', './dryer-building-envelope.js', './dryer-route-environment.js',
  './outdoor-data.js', './outdoor-models.js', './campus-data.js', './campus-models.js', './packaging-data.js', './packaging-models.js',
  './placement-rules.js', './person-walk.js', './proximity-doors.js',
]);

export async function exportDryerPresentation({ output } = {}) {
  const filenames = [
    'share/dryer-index.html', 'share/dryer-app.js', 'share/styles.css', 'share/dryer-styles.css', 'layout-editor.css', 'furnace-detail.css',
    'scene.js', 'facility-models.js', 'furnace-model.js', 'furnace-drawing-data.js', 'furnace-drawing-model.js', 'furnace-detail.js',
    'layout-editor.js', 'placement-rules.js', 'proximity-doors.js', 'dryer-upper-models.js', 'dryer-building-envelope.js',
    'dryer-process-models.js', 'preparation-models.js', 'preparation-environment.js', 'dryer-route-environment.js',
  ];
  const values = await Promise.all(filenames.map(name => read(`apps/site/${name}`)));
  const sources = Object.fromEntries(filenames.map((name, index) => [name, values[index]]));
  const [three, license, threeManifest] = await Promise.all([
    read('apps/shared/vendor/three.export.min.js'), read('apps/shared/vendor/THREE-LICENSE.txt'), read('apps/shared/vendor/three.export.min.meta.json').then(JSON.parse),
  ]);
  for (const entry of [threeManifest.source, threeManifest.result]) {
    const bytes = await readFile(new URL(`apps/shared/vendor/${entry.file}`, root));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Three.js offline derivative hash mismatch: ${entry.file}`);
  }

  // Keep the dryer building and its equipment, including the roof service bay.
  // The adjacent boiler room has a numeric-floor proxy but is a separate room.
  const equipment = EQUIPMENT.filter(item => Number.isFinite(item.floor) && item.id !== 'f1-boiler-room' && !item.samePhysicalRoomAs)
    .map(item => Object.fromEntries(modelFields.filter(field => field in item).map(field => [field, item[field]])));
  const floors = FLOORS.map(({ reference, photos, source, sourceReference, summary, personStart, ...floor }) => floor);
  const data = `const FLOORS = ${JSON.stringify(floors)};\nconst FLOOR_HEIGHT = ${FLOOR_HEIGHT};\nconst EQUIPMENT = ${JSON.stringify(equipment)};\nconst floorElevation = ${floorElevation.toString()};\nconst floorHeight = ${floorHeight.toString()};`;
  // Generic scene methods retain harmless room identifiers. No external room
  // layout, equipment catalog or builder is included in this presentation.
  const disabledRooms = 'const OUTDOOR_ROOM = Object.freeze({}); const CAMPUS_ROOM = Object.freeze({}); const PACKAGING_ROOM = Object.freeze({}); const PACKAGING_ROOMS = Object.freeze({}); const PACKAGING_OVERVIEW = Object.freeze({}); const PACKAGING_FLOOR_ELEVATIONS = Object.freeze({});\nconst buildPreparationBoilerRoom = () => false;';
  let scene = sources['scene.js'].replace(/^import\s+[^\n]+?\s+from\s+['"]([^'"]+)['"];?\s*$/gm, (statement, dependency) => {
    if (!sceneDependencies.has(dependency)) throw new Error(`Unknown scene dependency in dryer profile: ${dependency}`);
    return '';
  });
  scene = replaceRequired(scene, 'return new FacilityScene(canvas, options);', "return new FacilityScene(canvas, { ...options, enabledAreas: ['dryer'], personEnabled: false });");
  let placementRules = sources['placement-rules.js'];
  const regionsStart = placementRules.indexOf('export const PLACEMENT_REGIONS =');
  const regionsEnd = placementRules.indexOf('\nconst EPS =', regionsStart);
  if (regionsStart < 0 || regionsEnd < 0) throw new Error('Missing placement region registry.');
  placementRules = placementRules.slice(0, regionsStart) + `export const PLACEMENT_REGIONS = Object.freeze(${JSON.stringify(Object.fromEntries(['building', 'upper', 'roof'].map(key => [key, PLACEMENT_REGIONS[key]])))});\n` + placementRules.slice(regionsEnd);
  const layoutEditor = replaceRequired(sources['layout-editor.js'], "const STORAGE_KEY = 'dryer-facility-layout-v1';", "const STORAGE_KEY = 'dryer-presentation-layout-v1';");

  let furnaceDetail = sources['furnace-detail.js'];
  for (const asset of SITE_ASSETS.filter(asset => asset.category === 'drawing-furnace')) {
    if (!furnaceDetail.includes(asset.path)) throw new Error(`Missing furnace drawing: ${asset.path}`);
    const bytes = await readFile(new URL(`apps/site/${asset.path.slice(2)}`, root));
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Invalid furnace JPEG: ${asset.path}`);
    furnaceDetail = furnaceDetail.replaceAll(asset.path, `data:image/jpeg;base64,${bytes.toString('base64')}`);
  }
  let app = sources['share/dryer-app.js'];
  for (const statement of [
    "import { EQUIPMENT, FLOORS } from '../building-data.js';",
    "import { createLayoutEditor } from '../layout-editor.js';",
    "import { createFurnaceDetail } from '../furnace-detail.js';",
    "import { BURNER_MAINTENANCE_DOCUMENTS } from '../burner-maintenance-data.js';",
    "  const { createFacilityScene } = await import('../scene.js');",
  ]) app = replaceRequired(app, statement, '');
  if (/^\s*(?:import|export)\s/m.test(app) || /\bimport\s*\(/.test(app)) throw new Error('Unexpected dryer viewer import.');

  const code = [
    namespace(three, 'THREE'), data, disabledRooms,
    namespace(sources['facility-models.js'], 'modelsModule'), 'const { buildFacilityEquipment } = modelsModule;',
    namespace(sources['furnace-model.js'], 'furnaceModelModule'), 'const { buildFurnace } = furnaceModelModule;',
    namespace(sources['furnace-drawing-data.js'], 'furnaceDrawingDataModule'),
    'const { BASIS, DIMENSIONS, DRAWING_GROUPS, DRAWING_INFO, DRAWING_PARTS, DRAWING_SHEETS, FIELD_STATUS, GAS_PATH, PART_BY_ID, PILOT_PATH, TRAIN_GASKET_ALLOWANCE } = furnaceDrawingDataModule;',
    namespace(sources['furnace-drawing-model.js'], 'furnaceDrawingModelModule', [
      "import * as THREE from '../shared/vendor/three.module.js';",
      "import { DIMENSIONS, DRAWING_PARTS, TRAIN_GASKET_ALLOWANCE } from './furnace-drawing-data.js';",
    ]), 'const { createDrawingModel, DIMENSION_LINES, FLOW_TAG } = furnaceDrawingModelModule;',
    await bundleBurnerMaintenance(),
    namespace(furnaceDetail, 'furnaceDetailModule', [
      "import * as THREE from '../shared/vendor/three.module.js';",
      "import { buildFurnace } from './furnace-model.js';",
      "import { createDrawingModel, DIMENSION_LINES, FLOW_TAG } from './furnace-drawing-model.js';",
      "import { BASIS, DRAWING_GROUPS, DRAWING_INFO, DRAWING_PARTS, DRAWING_SHEETS, FIELD_STATUS, GAS_PATH, PART_BY_ID, PILOT_PATH } from './furnace-drawing-data.js';",
      "import { createBurnerMaintenance } from './burner-maintenance.js';",
    ]), 'const { createFurnaceDetail } = furnaceDetailModule;',
    namespace(placementRules, 'placementRulesModule'),
    'const { PLACEMENT_RULES, PLACEMENT_REGIONS, constrainPlacement, toRoomPosition, fromRoomPosition, rotatedFootprint } = placementRulesModule;',
    namespace(sources['proximity-doors.js'], 'proximityDoorsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
    'const { createProximityDoorController } = proximityDoorsModule;',
    namespace(sources['dryer-upper-models.js'], 'dryerUpperModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';", "import { buildFurnace } from './furnace-model.js';"]),
    'const { buildDryerUpperEnvironment, buildDryerUpperEquipment } = dryerUpperModelsModule;',
    namespace(sources['dryer-building-envelope.js'], 'dryerBuildingEnvelopeModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
    'const { buildDryerBuildingEnvironment } = dryerBuildingEnvelopeModule;',
    namespace(sources['dryer-process-models.js'], 'dryerProcessModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
    'const { buildDryerProcessEquipment } = dryerProcessModelsModule;',
    namespace(sources['preparation-models.js'], 'preparationModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
    'const { buildPreparationEquipment } = preparationModelsModule;',
    namespace(sources['preparation-environment.js'], 'preparationEnvironmentModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
    'const { buildPreparationEnvironment } = preparationEnvironmentModule;',
    namespace(sources['dryer-route-environment.js'], 'dryerRouteEnvironmentModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
    'const { buildDryerRouteEnvironment } = dryerRouteEnvironmentModule;',
    namespace(scene, 'sceneModule'), 'const { createFacilityScene } = sceneModule;',
    namespace(layoutEditor, 'layoutEditorModule'), 'const { createLayoutEditor } = layoutEditorModule;', app,
  ].join('\n');
  const check = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: code, encoding: 'utf8', windowsHide: true });
  if (check.status !== 0) throw new Error(check.stderr || 'Dryer presentation JavaScript syntax check failed.');
  let html = sources['share/dryer-index.html'];
  for (const [href, source] of [
    ['./styles.css', sources['share/styles.css']], ['./dryer-styles.css', sources['share/dryer-styles.css']],
    ['../layout-editor.css', sources['layout-editor.css']], ['../furnace-detail.css', sources['furnace-detail.css']],
  ]) {
    if (/@import\b|url\(\s*['"]?(?:https?:|\/\/)/i.test(source)) throw new Error(`Viewer stylesheet must remain offline: ${href}`);
    html = replaceRequired(html, `<link rel="stylesheet" href="${href}">`, `<style>\n${source.replace(/<\/style/gi, '<\\/style')}\n</style>`);
  }
  html = replaceRequired(html, '<script type="module" src="./dryer-app.js"></script>', '');
  html = replaceRequired(html, '</body>', `<!-- Three.js license:\n${license.replace(/--/g, '- -')}\n-->\n<script type="module">\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>\n</body>`);
  if (/\b(?:src|href)\s*=\s*["'](?:\.\.?\/|https?:|\/\/)/i.test(html)) throw new Error('Dryer presentation still depends on another file.');
  const target = output ? pathToFileURL(path.resolve(output)) : new URL('exports/건조실-발표용.html', root);
  await mkdir(new URL('./', target), { recursive: true });
  await writeFile(target, html, 'utf8');
  console.log(`Created dryer-only ${fileURLToPath(target)} (${Buffer.byteLength(html).toLocaleString()} bytes, ${equipment.length} dryer models).`);
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) throw new Error('Usage: node tooling/export-dryer-presentation.mjs [output.html]');
  await exportDryerPresentation({ output: process.argv[2] });
}
